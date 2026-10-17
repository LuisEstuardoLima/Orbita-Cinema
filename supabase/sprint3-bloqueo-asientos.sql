-- =====================================================================
-- SCRUM-119 · Bloqueo temporal de asientos (5 minutos) y liberación automática
-- Ejecutar UNA VEZ en el SQL Editor de Supabase. Es idempotente (se puede repetir).
--
-- Usa las tablas que ya existen: `reserva` (estado 'pendiente_pago' + fecha_expiracion,
-- que por defecto es now() + 5 min) y `detalle_reserva` (un asiento por fila, estado
-- 'bloqueado' | 'reservado' | 'liberado'). Solo agrega lo que falta:
--   1) reserva.token_sesion: dueño del bloqueo (cookie del navegador). Sirve para cliente
--      registrado e invitado; con él el servidor sabe qué bloqueo es de quién.
--   2) Índice único parcial: un asiento solo puede estar bloqueado/reservado en UNA reserva
--      por función. Es lo que impide, a nivel de base, que dos clientes tomen el mismo asiento.
--   3) Funciones que hacen cada paso de forma ATÓMICA (una sola transacción).
--
-- Un bloqueo vencido libera el asiento al instante (las consultas lo ignoran por hora) y
-- además se marca como 'expirada'/'liberado' la próxima vez que alguien bloquee esa función
-- o cuando corra `liberar_bloqueos_vencidos()` (ver el final para programarla).
-- =====================================================================

alter table public.reserva add column if not exists token_sesion uuid;

create index if not exists idx_reserva_token_pendiente
  on public.reserva (token_sesion)
  where estado = 'pendiente_pago';

create unique index if not exists uq_detalle_reserva_asiento_funcion_activo
  on public.detalle_reserva (id_funcion, id_asiento)
  where estado in ('bloqueado', 'reservado');

-- ---------------------------------------------------------------------
-- Bloquear asientos (criterio 1). Todo o nada.
-- Errores que lanza (los reconoce la app): datos_invalidos, funcion_no_disponible,
-- asiento_invalido, asiento_ocupado.
-- ---------------------------------------------------------------------
create or replace function public.bloquear_asientos(
  p_funcion      bigint,
  p_asientos     bigint[],
  p_tipos        text[],
  p_precios      numeric[],
  p_porcentaje   numeric,
  p_token        uuid,
  p_usuario      uuid,
  p_nombre       text,
  p_correo       text,
  p_telefono     text
)
returns table (out_id_reserva bigint, out_segundos integer)
language plpgsql
as $$
declare
  v_sala     bigint;
  v_n        integer;
  v_subtotal numeric;
  v_recargo  numeric;
  v_id       bigint;
  v_exp      timestamptz;
begin
  if p_funcion is null or p_token is null
     or coalesce(array_length(p_asientos, 1), 0) = 0
     or array_length(p_asientos, 1) <> coalesce(array_length(p_tipos, 1), -1)
     or array_length(p_asientos, 1) <> coalesce(array_length(p_precios, 1), -1)
     or (select count(distinct a) from unnest(p_asientos) a) <> array_length(p_asientos, 1) then
    raise exception 'datos_invalidos';
  end if;

  select f.id_sala into v_sala from public.funcion f where f.id = p_funcion and f.activa;
  if v_sala is null then
    raise exception 'funcion_no_disponible';
  end if;

  -- 1) Bloqueos vencidos de esta función: se liberan.
  with vencidas as (
    update public.reserva r
       set estado = 'expirada', updated_at = now()
     where r.id_funcion = p_funcion
       and r.estado = 'pendiente_pago'
       and r.fecha_expiracion <= now()
    returning r.id_reserva
  )
  update public.detalle_reserva d
     set estado = 'liberado'
    from vencidas v
   where d.id_reserva = v.id_reserva and d.estado = 'bloqueado';

  -- 2) Bloqueo anterior de este mismo cliente (cambió de asientos o volvió a intentar).
  with previas as (
    update public.reserva r
       set estado = 'cancelada_cliente', updated_at = now()
     where r.token_sesion = p_token and r.estado = 'pendiente_pago'
    returning r.id_reserva
  )
  update public.detalle_reserva d
     set estado = 'liberado'
    from previas v
   where d.id_reserva = v.id_reserva and d.estado = 'bloqueado';

  -- 3) Los asientos deben ser de la sala de la función y vendibles (estado 'normal').
  select count(*) into v_n
    from public.asiento a
   where a.id = any (p_asientos) and a.id_sala = v_sala and a.estado = 'normal';
  if v_n <> array_length(p_asientos, 1) then
    raise exception 'asiento_invalido';
  end if;

  -- 4) La reserva pendiente: fecha_bloqueo = ahora, fecha_expiracion = ahora + 5 min (default).
  select coalesce(sum(x), 0) into v_subtotal from unnest(p_precios) x;
  v_recargo := round(v_subtotal * p_porcentaje / 100, 2);

  insert into public.reserva
    (id_usuario, id_funcion, nombre_comprador, correo_comprador, telefono_comprador,
     subtotal, porcentaje_recargo, monto_recargo, total, estado, token_sesion)
  values
    (p_usuario, p_funcion, p_nombre, p_correo, p_telefono,
     v_subtotal, p_porcentaje, v_recargo, v_subtotal + v_recargo, 'pendiente_pago', p_token)
  returning id_reserva, fecha_expiracion into v_id, v_exp;

  -- 5) Un detalle por asiento. Si otro cliente se adelantó, el índice único falla -> todo se revierte.
  begin
    insert into public.detalle_reserva (id_reserva, id_funcion, id_asiento, tipo_entrada, precio, estado)
    select v_id, p_funcion, u.a, u.t, u.p, 'bloqueado'
      from unnest(p_asientos, p_tipos, p_precios) as u(a, t, p);
  exception when unique_violation then
    raise exception 'asiento_ocupado';
  end;

  return query select v_id, greatest(0, ceil(extract(epoch from (v_exp - now()))))::integer;
end;
$$;

-- ---------------------------------------------------------------------
-- Liberar el bloqueo vigente de un cliente de inmediato (criterio 6).
-- Devuelve cuántas reservas liberó.
-- ---------------------------------------------------------------------
create or replace function public.liberar_bloqueo(p_token uuid)
returns integer
language plpgsql
as $$
declare
  v_n integer;
begin
  with previas as (
    update public.reserva r
       set estado = 'cancelada_cliente', updated_at = now()
     where r.token_sesion = p_token and r.estado = 'pendiente_pago'
    returning r.id_reserva
  ), liberadas as (
    update public.detalle_reserva d
       set estado = 'liberado'
      from previas v
     where d.id_reserva = v.id_reserva and d.estado = 'bloqueado'
    returning d.id_detalle
  )
  select count(*) into v_n from previas;
  return v_n;
end;
$$;

-- ---------------------------------------------------------------------
-- Bloqueo vigente de un cliente, con los segundos que le quedan (criterios 4 y 5).
-- Devuelve NULL si no tiene bloqueo o ya venció.
-- ---------------------------------------------------------------------
create or replace function public.bloqueo_vigente(p_token uuid)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
           'id_reserva', r.id_reserva,
           'id_funcion', r.id_funcion,
           'total', r.total,
           'segundos_restantes',
             greatest(0, ceil(extract(epoch from (r.fecha_expiracion - now()))))::integer,
           'asientos', (
             select coalesce(
                      jsonb_agg(jsonb_build_object('id', a.id, 'fila', a.fila, 'numero', a.numero)
                                order by a.fila, a.numero),
                      '[]'::jsonb)
               from public.detalle_reserva d
               join public.asiento a on a.id = d.id_asiento
              where d.id_reserva = r.id_reserva and d.estado = 'bloqueado')
         )
    from public.reserva r
   where r.token_sesion = p_token
     and r.estado = 'pendiente_pago'
     and r.fecha_expiracion > now()
   order by r.id_reserva desc
   limit 1;
$$;

-- ---------------------------------------------------------------------
-- Asientos NO disponibles de una función (criterios 2 y 3):
--   · reservados (ya pagados), y
--   · bloqueados por una reserva pendiente que TODAVÍA no vence.
-- Un bloqueo vencido no cuenta, así que el asiento vuelve a estar libre para todos.
-- `p_excluir_token`: no cuenta el bloqueo del propio cliente (cuando regresa a elegir).
-- ---------------------------------------------------------------------
create or replace function public.asientos_no_disponibles(p_funcion bigint, p_excluir_token uuid default null)
returns setof bigint
language sql
stable
as $$
  select d.id_asiento
    from public.detalle_reserva d
    join public.reserva r on r.id_reserva = d.id_reserva
   where d.id_funcion = p_funcion
     and (
           d.estado = 'reservado'
        or (d.estado = 'bloqueado'
            and r.estado = 'pendiente_pago'
            and r.fecha_expiracion > now()
            and (p_excluir_token is null or r.token_sesion is distinct from p_excluir_token))
         );
$$;

-- ---------------------------------------------------------------------
-- Limpieza de bloqueos vencidos de TODAS las funciones (liberación automática, criterio 3).
-- ---------------------------------------------------------------------
create or replace function public.liberar_bloqueos_vencidos()
returns integer
language plpgsql
as $$
declare
  v_n integer;
begin
  with vencidas as (
    update public.reserva r
       set estado = 'expirada', updated_at = now()
     where r.estado = 'pendiente_pago' and r.fecha_expiracion <= now()
    returning r.id_reserva
  ), liberadas as (
    update public.detalle_reserva d
       set estado = 'liberado'
      from vencidas v
     where d.id_reserva = v.id_reserva and d.estado = 'bloqueado'
    returning d.id_detalle
  )
  select count(*) into v_n from vencidas;
  return v_n;
end;
$$;

-- ---------------------------------------------------------------------
-- Permisos: solo el servidor (service_role) puede llamarlas. Nunca el navegador.
-- ---------------------------------------------------------------------
revoke all on function public.bloquear_asientos(bigint, bigint[], text[], numeric[], numeric, uuid, uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.liberar_bloqueo(uuid) from public, anon, authenticated;
revoke all on function public.bloqueo_vigente(uuid) from public, anon, authenticated;
revoke all on function public.asientos_no_disponibles(bigint, uuid) from public, anon, authenticated;
revoke all on function public.liberar_bloqueos_vencidos() from public, anon, authenticated;

grant execute on function public.bloquear_asientos(bigint, bigint[], text[], numeric[], numeric, uuid, uuid, text, text, text) to service_role;
grant execute on function public.liberar_bloqueo(uuid) to service_role;
grant execute on function public.bloqueo_vigente(uuid) to service_role;
grant execute on function public.asientos_no_disponibles(bigint, uuid) to service_role;
grant execute on function public.liberar_bloqueos_vencidos() to service_role;

-- ---------------------------------------------------------------------
-- OPCIONAL: ejecutar la limpieza cada minuto con pg_cron (Database > Extensions > pg_cron).
-- No es obligatorio: sin esto los asientos igual se liberan a la hora exacta.
--
--   select cron.schedule('liberar-bloqueos-vencidos', '* * * * *',
--                        $$select public.liberar_bloqueos_vencidos()$$);
-- ---------------------------------------------------------------------
