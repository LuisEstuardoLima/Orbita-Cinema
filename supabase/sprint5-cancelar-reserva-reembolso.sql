-- =====================================================================
-- Órbita Cinema · SCRUM-131 / SCRUM-132 · Cancelar reserva y reembolso en puntos
-- Ejecutar en Supabase > SQL Editor. Es idempotente (create or replace).
--
-- Operación ATÓMICA (todo en una transacción PL/pgSQL):
--   1) Bloquea la reserva con FOR UPDATE y valida que pertenezca al usuario.
--   2) Valida que la función asociada exista y tenga fecha y hora válidas.
--   3) Valida que reserva.total sea > 0 y que CEIL(total) quepa en integer.
--   4) Solo reservas 'confirmada' se pueden cancelar.
--   5) Valida plazo: inicio de la función - ahora >= 30 minutos (inclusive).
--   6) Verifica consistencia: no debe existir ya un reembolso para esta reserva.
--   7) Pasa reserva a 'cancelada_cliente'.
--   8) Libera asientos (detalle_reserva -> 'liberado').
--   9) Reversión de puntos: si existe movimiento 'compra', inserta
--      'reversion_compra' con los mismos puntos negados (sin recalcular).
--      Si ya existe una reversión previa, falla y revierte todo.
--   10) Reembolso: inserta 'reembolso_cancelacion' con CEIL(total).
--       Si ya existe un reembolso previo, falla y revierte todo.
--
-- Idempotencia y simultáneas:
--   - FOR UPDATE serializa solicitudes concurrentes sobre la misma reserva.
--   - Si la reserva ya está 'cancelada_cliente', retorna ok=true sin cambios.
--   - NO se usa ON CONFLICT DO NOTHING: cualquier conflicto de unicidad
--     en punto_lealtad lanza excepción y revierte toda la transacción.
--     Esto garantiza que nunca quede una cancelación parcial.
--
-- Solo la puede llamar el backend con service_role: el navegador jamás.
-- =====================================================================

create or replace function public.cancelar_reserva_reembolso(
  p_id_reserva bigint,
  p_id_usuario uuid
)
returns jsonb
language plpgsql
as $$
declare
  v_r              public.reserva%rowtype;
  v_funcion        public.funcion%rowtype;
  v_inicio         timestamptz;
  v_puntos_compra    integer;
  v_puntos_reembolso integer;
  v_n_mov_compra     integer;
  v_existe_reversion boolean;
  v_existe_reembolso boolean;
begin
  -- 1) Bloquear la reserva y validar que pertenezca al usuario autenticado.
  --    Dos solicitudes concurrentes se serializan aquí; la segunda ve el
  --    resultado de la primera y actúa en consecuencia (idempotencia).
  select * into v_r
    from public.reserva
   where id_reserva = p_id_reserva
     and id_usuario = p_id_usuario
   for update;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'motivo', 'reserva_no_encontrada_o_no_pertenece'
    );
  end if;

  -- 2) Solo reservas confirmadas se pueden cancelar.
  --    Si ya está cancelada, es idempotente: no hacer cambios.
  if v_r.estado = 'cancelada_cliente' then
    return jsonb_build_object(
      'ok', true,
      'ya_cancelada', true,
      'motivo', null,
      'id_reserva', v_r.id_reserva,
      'estado', v_r.estado
    );
  end if;

  if v_r.estado <> 'confirmada' then
    return jsonb_build_object(
      'ok', false,
      'motivo', 'reserva_no_confirmada'
    );
  end if;

  -- 3) Validar que reserva.total sea válido y positivo antes de modificar datos.
  if v_r.total is null or v_r.total <= 0 then
    return jsonb_build_object(
      'ok', false,
      'motivo', 'total_invalido'
    );
  end if;

  -- 3b) Validar que CEIL(total) no desborde integer (max 2147483647).
  --    total es numeric(10,2) -> max 99999999.99 -> CEIL = 100000000, cabe en integer,
    --    pero validamos por seguridad.
  if ceil(v_r.total) > 2147483647 then
    return jsonb_build_object(
      'ok', false,
      'motivo', 'total_desborda_integer'
    );
  end if;


  -- 4) Validar que la función asociada exista y tenga fecha y hora válidas.
  select * into v_funcion
    from public.funcion
   where id = v_r.id_funcion;

  if not found then
    return jsonb_build_object(
      'ok', false,
      'motivo', 'funcion_no_encontrada'
    );
  end if;

  if v_funcion.fecha is null or v_funcion.hora is null then
    return jsonb_build_object(
      'ok', false,
      'motivo', 'funcion_sin_fecha_hora'
    );
  end if;

  -- 5) Validar plazo de cancelación: hasta exactamente 30 minutos antes
  --    del inicio de la función (inclusive). Con menos de 30 minutos se rechaza.
  v_inicio := (v_funcion.fecha + v_funcion.hora) AT TIME ZONE 'America/Guatemala';

  if v_inicio - now() < interval '30 minutes' then
    return jsonb_build_object(
      'ok', false,
      'motivo', 'plazo_vencido'
    );
  end if;

  -- 6) Verificar consistencia: no debe existir ya un reembolso para esta reserva.
  --    Si existe, el estado es inconsistente (reserva confirmada pero con reembolso previo).
  select exists (
    select 1 from public.punto_lealtad
    where id_reserva = v_r.id_reserva
      and tipo_movimiento = 'reembolso_cancelacion'
  ) into v_existe_reembolso;

  if v_existe_reembolso then
    return jsonb_build_object(
      'ok', false,
      'motivo', 'estado_inconsistente_reembolso_previo'
    );
  end if;

  -- 6b) Verificar consistencia: no debe existir ya una reversión para esta reserva.
  select exists (
    select 1 from public.punto_lealtad
    where id_reserva = v_r.id_reserva
      and tipo_movimiento = 'reversion_compra'
  ) into v_existe_reversion;

  if v_existe_reversion then
    return jsonb_build_object(
      'ok', false,
      'motivo', 'estado_inconsistente_reversion_previa'
    );
  end if;

  -- 7) Cambiar estado de la reserva a cancelada.
  update public.reserva
     set estado = 'cancelada_cliente',
         updated_at = now()
   where id_reserva = v_r.id_reserva;

  -- 8) Liberar asientos asociados (bloqueados o reservados -> liberado).
  update public.detalle_reserva
     set estado = 'liberado'
   where id_reserva = v_r.id_reserva
     and estado in ('bloqueado', 'reservado');


  -- 9) Reversión de puntos de compra: validar consistencia de movimientos originales.
  --    Contar y sumar movimientos 'compra' de esta reserva y usuario.
  --    Si hay más de uno, el estado es inconsistente: rechazar sin modificar nada.
  --    Si no hay ninguno, permitir cancelar y reembolsar sin reversión.
  select count(*), coalesce(sum(puntos), 0)
    into v_n_mov_compra, v_puntos_compra
    from public.punto_lealtad
   where id_reserva = v_r.id_reserva
     and tipo_movimiento = 'compra'
     and id_usuario = p_id_usuario;

  if v_n_mov_compra > 1 then
    return jsonb_build_object(
      'ok', false,
      'motivo', 'estado_inconsistente_multiples_compras'
    );
  end if;

  if v_n_mov_compra = 1 then
    insert into public.punto_lealtad
      (id_usuario, id_reserva, tipo_movimiento, puntos, descripcion)
    values
      (
        p_id_usuario,
        v_r.id_reserva,
        'reversion_compra',
        -v_puntos_compra,
        'Reversion puntos por compra cancelada ORB-' ||
        lpad(p_id_reserva::text, 6, '0')
      );
  end if;

  -- 10) Reembolso en puntos: CEIL(total) (1 punto por cada Q1, redondeo hacia arriba).
  --    Usamos INSERT sin ON CONFLICT: si hay un conflicto inesperado, la
  --    excepción revierte toda la transacción.
  v_puntos_reembolso := ceil(v_r.total)::integer;

  insert into public.punto_lealtad
    (id_usuario, id_reserva, tipo_movimiento, puntos, descripcion)
  values
    (
      p_id_usuario,
      v_r.id_reserva,
      'reembolso_cancelacion',
      v_puntos_reembolso,
      'Reembolso por cancelacion ORB-' ||
      lpad(v_r.id_reserva::text, 6, '0')
    );

  return jsonb_build_object(
    'ok', true,
    'ya_cancelada', false,
    'motivo', null,
    'id_reserva', v_r.id_reserva,
    'estado', 'cancelada_cliente',
    'reembolso_puntos', v_puntos_reembolso,
    'puntos_revertidos', v_puntos_compra
  );
end;
$$;

-- ---------------------------------------------------------------------
-- Permisos: solo el backend (service_role) puede llamarla. Nunca el navegador.
-- Mismo patrón que validar_entrada y confirmar_compra.
-- ---------------------------------------------------------------------
revoke all on function public.cancelar_reserva_reembolso(bigint, uuid)
  from public, anon, authenticated;

grant execute on function public.cancelar_reserva_reembolso(bigint, uuid)
  to service_role;

-- ---------------------------------------------------------------------
-- Reparación de descripciones históricas de reversiones.
-- La columna id_reserva es la fuente de verdad para el código ORB-XXXXXX.
-- Solo actualiza el texto de movimientos reversion_compra; no altera puntos,
-- reservas ni los movimientos de compra/reembolso.
-- ---------------------------------------------------------------------
update public.punto_lealtad
   set descripcion = 'Reversion puntos por compra cancelada ORB-' ||
                     lpad(id_reserva::text, 6, '0')
 where tipo_movimiento = 'reversion_compra'
   and id_reserva is not null;
