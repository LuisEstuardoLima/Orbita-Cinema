-- MIGRACIÓN: canje de puntos en checkout de Órbita Cinema
-- Revisar respaldo antes de ejecutar en producción.
-- El total de reserva se conserva como total bruto; pago.monto guarda el neto pagado.

begin;

-- Extender el libro de puntos con un movimiento negativo de canje.
alter table public.punto_lealtad drop constraint if exists punto_lealtad_tipo_movimiento_check;
alter table public.punto_lealtad add constraint punto_lealtad_tipo_movimiento_check
  check (tipo_movimiento in ('compra','reversion_compra','reembolso_cancelacion','canje'));
alter table public.punto_lealtad drop constraint if exists chk_puntos_signo;
alter table public.punto_lealtad add constraint chk_puntos_signo check (
  (tipo_movimiento in ('reversion_compra','canje') and puntos < 0)
  or (tipo_movimiento in ('compra','reembolso_cancelacion') and puntos > 0)
);

-- Permitir registrar una compra totalmente cubierta por puntos.
alter table public.pago drop constraint if exists pago_monto_check;
alter table public.pago add constraint pago_monto_check check (monto >= 0);
alter table public.pago drop constraint if exists pago_metodo_pago_check;
alter table public.pago add constraint pago_metodo_pago_check
  check (metodo_pago in ('tarjeta_credito','tarjeta_debito','puntos'));

-- =====================================================================
-- Órbita Cinema · Sprint 3 · SCRUM-125 · confirmar_compra
-- Ejecutar en Supabase > SQL Editor después de sprint3-compra.sql.
-- Es idempotente: create or replace function.
--
-- Registra la compra COMPLETA cuando el pago simulado se aprueba, en una
-- sola transacción (todo o nada — CA5 del registro):
--   1) bloquea la reserva más reciente del navegador (FOR UPDATE) y valida
--      que esté en 'pendiente_pago', sin vencer, que su función y película
--      sigan activas y que el monto coincida con el total de la reserva;
--   2) escribe los datos reales del comprador (cliente o invitado) y pasa
--      la reserva a 'confirmada' (fecha_reserva = fecha de compra; fecha_bloqueo
--      conserva cuándo se tomó el asiento);
--   3) pasa los asientos de 'bloqueado' a 'reservado';
--   4) inserta el pago (solo los últimos 4 dígitos; nunca número completo
--      ni CVV — CA6) y el boleto (un QR por reserva);
--   5) registra puntos de lealtad (SCRUM-130): 1 punto por cada Q10 del
--      total pagado, redondeo hacia arriba. Solo para clientes registrados
--      (id_usuario IS NOT NULL). Los invitados no generan puntos.
-- Si algo falla, PostgreSQL revierte TODO: no queda ninguna reserva a medias.
-- Un doble clic es idempotente: si la reserva ya está 'confirmada', devuelve
-- el mismo resultado sin registrar nada otra vez (se conserva token_sesion
-- para eso; bloqueo_vigente lo ignora porque filtra 'pendiente_pago').
--
-- Solo la puede llamar el backend con service_role: el navegador jamás.
-- =====================================================================

drop function if exists public.confirmar_compra(uuid, text, text, text, text, numeric, text, uuid);

create or replace function public.confirmar_compra(
  p_token uuid,
  p_nombre text,
  p_correo text,
  p_telefono text,
  p_metodo_pago text,
  p_monto numeric,
  p_ultimos_4 text,
  p_clave_idempotencia uuid,
  p_puntos_canjeados integer default 0
)
returns table (out_id_reserva bigint, out_codigo_qr uuid)
language plpgsql
as $$
declare
  v_r public.reserva%rowtype;
  v_activa boolean;
  v_n integer;
  v_puntos integer;
  v_saldo integer;
  v_descuento numeric(10,2);
  v_metodo text;
begin
  -- 0) Datos mínimos: nada de campos vacíos ni formatos inválidos.
  if p_token is null
     or coalesce(trim(p_nombre), '') = ''
     or coalesce(trim(p_correo), '') = ''
     or p_metodo_pago is null
     or p_metodo_pago not in ('tarjeta_credito', 'tarjeta_debito', 'puntos')
     or p_monto is null or p_monto < 0
     or p_clave_idempotencia is null then
    raise exception 'datos_invalidos';
  end if;

  -- Si queda saldo por pagar, debe ser con tarjeta y traer sus últimos 4 dígitos.
  -- Si el total es Q0, solo se acepta el método puntos y no se exige tarjeta.
  if (p_monto > 0 and (p_metodo_pago = 'puntos'
       or p_ultimos_4 is null or p_ultimos_4 !~ '^[0-9]{4}$'))
     or (p_monto = 0 and p_metodo_pago <> 'puntos') then
    raise exception 'datos_invalidos';
  end if;

  -- 1) La reserva más reciente de este navegador, bloqueada para escritura:
  --    dos "Pagar" concurrentes se serializan aquí (FOR UPDATE).
  select * into v_r
    from public.reserva
   where token_sesion = p_token
   order by id_reserva desc
   limit 1
      for update;
  if not found then
    raise exception 'reserva_no_encontrada';
  end if;

  -- Doble clic o reintento: si ya quedó confirmada, devuelve el resultado
  -- existente sin registrar nada otra vez (idempotente).
  if v_r.estado = 'confirmada' then
    return query
      select b.id_reserva, b.codigo_qr
        from public.boleto b
       where b.id_reserva = v_r.id_reserva;
    return;
  end if;

  if v_r.estado <> 'pendiente_pago' then
    raise exception 'reserva_no_pendiente'; -- expirada o cancelada
  end if;
  if v_r.fecha_expiracion <= now() then
    raise exception 'bloqueo_vencido';
  end if;

  -- 2) Relee función y película activas en el instante de confirmar
  --    (README: releer ambas al confirmar el pago, no solo al leer).
  select f.activa and pe.activa into v_activa
    from public.funcion f
    join public.pelicula pe on pe.id = f.id_pelicula
   where f.id = v_r.id_funcion;
  if coalesce(v_activa, false) = false then
    raise exception 'funcion_no_disponible';
  end if;

  -- 3) Validar saldo y descuento dentro de la misma transacción.
  -- 1 punto equivale a Q1. El descuento nunca supera el total bruto.
  if coalesce(p_puntos_canjeados, 0) > 0 and v_r.id_usuario is null then
    raise exception 'canje_requiere_cuenta';
  end if;
  if v_r.id_usuario is not null then
    -- Serializar canjes concurrentes del mismo usuario (aunque sean reservas distintas).
    perform 1 from public.usuarios u where u.id_usuario = v_r.id_usuario for update;
    select coalesce(sum(pl.puntos), 0)::integer into v_saldo
      from public.punto_lealtad pl
     where pl.id_usuario = v_r.id_usuario;
  else
    v_saldo := 0;
  end if;
  if coalesce(p_puntos_canjeados, 0) > v_saldo then
    raise exception 'saldo_puntos_insuficiente';
  end if;
  v_descuento := least(v_r.total, coalesce(p_puntos_canjeados, 0)::numeric);
  if p_monto <> (v_r.total - v_descuento) then
    raise exception 'monto_no_coincide';
  end if;
  if p_monto = 0 and p_metodo_pago <> 'puntos' then
    raise exception 'metodo_pago_invalido';
  elsif p_monto > 0 and p_metodo_pago = 'puntos' then
    raise exception 'metodo_pago_invalido';
  end if;
  if p_monto > 0 and (p_ultimos_4 is null or p_ultimos_4 !~ '^[0-9]{4}$') then
    raise exception 'datos_invalidos';
  end if;

  -- 4) Comprador real + reserva confirmada. fecha_reserva pasa a ser la
  --    fecha de compra (fecha_bloqueo conserva cuándo se tomó el asiento).
  update public.reserva
     set nombre_comprador = trim(p_nombre),
         correo_comprador = trim(p_correo),
         telefono_comprador = nullif(trim(coalesce(p_telefono, '')), ''),
         estado = 'confirmada',
         fecha_reserva = now(),
         updated_at = now()
   where id_reserva = v_r.id_reserva;

  -- 5) Asientos: bloqueado -> reservado. Si no hay ninguno bloqueado, la
  --    reserva está corrupta: se revierte todo (nada a medias).
  update public.detalle_reserva
     set estado = 'reservado'
   where id_reserva = v_r.id_reserva
     and estado = 'bloqueado';
  get diagnostics v_n = row_count;
  if v_n = 0 then
    raise exception 'sin_detalles';
  end if;

  -- 6) Registrar canje y pago. El saldo se bloquea lógicamente por el FOR UPDATE
  -- de la reserva; la validación y los movimientos quedan en esta transacción.
  if coalesce(p_puntos_canjeados, 0) > 0 then
    insert into public.punto_lealtad
      (id_usuario, id_reserva, tipo_movimiento, puntos, descripcion)
    values
      (v_r.id_usuario, v_r.id_reserva, 'canje', -p_puntos_canjeados,
       'Canje de puntos en compra ORB-' || lpad(v_r.id_reserva::text, 6, '0'));
  end if;

  insert into public.pago
    (id_reserva, monto, metodo_pago, estado, clave_idempotencia,
     ultimos_4_tarjeta, fecha_resultado, detalle_resultado)
  values
    (v_r.id_reserva, p_monto, p_metodo_pago, 'aprobado', p_clave_idempotencia,
     case when p_monto > 0 then p_ultimos_4 else null end,
     now(),
     case when p_monto = 0 then 'Compra cubierta totalmente con puntos de lealtad.'
          else 'Pago simulado aprobado (sin conexión a banco real).' end);

  -- 7) Boleto: uno por reserva (el índice único lo garantiza).
  insert into public.boleto (id_reserva) values (v_r.id_reserva);

  -- 8) Puntos de lealtad (SCRUM-130): solo clientes registrados.
  --    1 punto por cada Q10 del total pagado, redondeo hacia arriba.
  --    Los invitados (id_usuario IS NULL) no generan puntos.
  if v_r.id_usuario is not null then
    v_puntos := ceil(p_monto / 10)::integer;
    if v_puntos > 0 then
    insert into public.punto_lealtad
      (id_usuario, id_reserva, tipo_movimiento, puntos, descripcion)
    values
      (v_r.id_usuario, v_r.id_reserva, 'compra', v_puntos,
       'Puntos por compra ORB-' || lpad(v_r.id_reserva::text, 6, '0'))
    on conflict (id_reserva, tipo_movimiento) do nothing;
    end if;
  end if;

  return query
    select b.id_reserva, b.codigo_qr
      from public.boleto b
     where b.id_reserva = v_r.id_reserva;
end;
$$;

-- ---------------------------------------------------------------------
-- Permisos: solo el backend (service_role) puede llamarla. Nunca el navegador.
-- Mismo patrón que las funciones de sprint3-bloqueo-asientos.sql.
-- ---------------------------------------------------------------------
revoke all on function public.confirmar_compra(uuid, text, text, text, text, numeric, text, uuid, integer)
  from public, anon, authenticated;
grant execute on function public.confirmar_compra(uuid, text, text, text, text, numeric, text, uuid, integer)
  to service_role;


commit;
