-- =====================================================================
-- Órbita Cinema · Sprint 4 · SCRUM-142 · reporte_ventas_reservas
-- Ejecutar en Supabase > SQL Editor (después de sprint3-confirmar-compra.sql).
-- Es idempotente: create or replace function. NO crea tablas ni copia datos: lee reserva,
-- detalle_reserva, pago, funcion, pelicula y sala, y no modifica nada (solo SELECT).
--
-- Definiciones (acordadas para el reporte):
--   · RESERVA VIGENTE = reserva confirmada o usada, o una compra en curso (pendiente_pago) cuyo
--     bloqueo todavía no vence. Las canceladas (cliente o función) y las expiradas NO cuentan.
--     Tampoco cuentan las reservas de una función cancelada (funcion.activa = false), aunque su
--     estado siga 'confirmada': el panel no las pasa a 'cancelada_funcion' al cancelar la función.
--   · VENTA = reserva vigente confirmada/usada CON pago aprobado. El importe recaudado es la suma
--     de pago.monto en estado 'aprobado' (un pago aprobado por reserva como máximo, por el índice
--     uq_pago_reserva_aprobado): los pagos rechazados/pendientes no se cuentan.
--   · Entradas = filas de detalle_reserva 'bloqueado' o 'reservado' de la reserva (las 'liberado' no).
--
-- Cada reserva se calcula UNA vez (subconsultas por reserva), así que unir con el detalle o con los
-- pagos no multiplica importes ni entradas.
--
-- p_agrupar: 'funcion' (una fila por función) o 'pelicula' (una fila por película, sumando sus
-- funciones). Filtra por la FECHA DE LA FUNCIÓN (pasadas, actuales y futuras), p_desde/p_hasta
-- inclusivos y opcionales, y por película (opcional). Solo salen filas con alguna reserva vigente.
--
-- Solo la llama el backend con service_role; el rol Administrador se verifica en el servidor.
-- =====================================================================

create or replace function public.reporte_ventas_reservas(
  p_desde    date   default null,
  p_hasta    date   default null,
  p_agrupar  text   default 'funcion',
  p_pelicula bigint default null
)
returns table (
  out_id_pelicula     bigint,
  out_pelicula        text,
  out_id_funcion      bigint,
  out_fecha           date,
  out_hora            time,
  out_sala            text,
  out_funciones       integer,
  out_reservas_cant   integer,
  out_reservas_entr   integer,
  out_reservas_importe numeric,
  out_ventas_cant     integer,
  out_ventas_entr     integer,
  out_ventas_importe  numeric
)
language plpgsql
stable
as $$
begin
  if p_agrupar is null or p_agrupar not in ('funcion', 'pelicula')
     or (p_desde is not null and p_hasta is not null and p_desde > p_hasta) then
    raise exception 'datos_invalidos';
  end if;

  if p_agrupar = 'funcion' then
    return query
    with res as (
      select r.id_reserva, r.id_funcion, r.total,
             (r.estado in ('confirmada', 'usada')) as pagable,
             (select count(*) from public.detalle_reserva d
               where d.id_reserva = r.id_reserva and d.estado in ('bloqueado', 'reservado')) as entradas,
             (select coalesce(sum(pg.monto), 0) from public.pago pg
               where pg.id_reserva = r.id_reserva and pg.estado = 'aprobado') as pagado
        from public.reserva r
       where r.estado in ('confirmada', 'usada')
          or (r.estado = 'pendiente_pago' and r.fecha_expiracion > now())
    ), det as (
      select f.id::bigint as id_funcion, f.id_pelicula::bigint as id_pelicula, f.id_sala::bigint as id_sala,
             f.fecha::date as fecha, f.hora::time as hora,
             x.total, x.entradas, x.pagado, (x.pagable and x.pagado > 0) as es_venta
        from res x
        join public.funcion f on f.id = x.id_funcion
       where coalesce(f.activa, false)
         and (p_desde is null or f.fecha::date >= p_desde)
         and (p_hasta is null or f.fecha::date <= p_hasta)
         and (p_pelicula is null or f.id_pelicula = p_pelicula)
    )
    select pe.id::bigint, pe.titulo::text, d.id_funcion, d.fecha, d.hora, sa.nombre::text,
           1,
           count(*)::integer,
           coalesce(sum(d.entradas), 0)::integer,
           coalesce(sum(d.total), 0)::numeric,
           (count(*) filter (where d.es_venta))::integer,
           coalesce(sum(d.entradas) filter (where d.es_venta), 0)::integer,
           coalesce(sum(d.pagado) filter (where d.es_venta), 0)::numeric
      from det d
      left join public.pelicula pe on pe.id = d.id_pelicula
      left join public.sala sa on sa.id = d.id_sala
     group by pe.id, pe.titulo, d.id_funcion, d.fecha, d.hora, sa.nombre
     order by d.fecha, d.hora, pe.titulo, d.id_funcion;
  else
    return query
    with res as (
      select r.id_reserva, r.id_funcion, r.total,
             (r.estado in ('confirmada', 'usada')) as pagable,
             (select count(*) from public.detalle_reserva d
               where d.id_reserva = r.id_reserva and d.estado in ('bloqueado', 'reservado')) as entradas,
             (select coalesce(sum(pg.monto), 0) from public.pago pg
               where pg.id_reserva = r.id_reserva and pg.estado = 'aprobado') as pagado
        from public.reserva r
       where r.estado in ('confirmada', 'usada')
          or (r.estado = 'pendiente_pago' and r.fecha_expiracion > now())
    ), det as (
      select f.id::bigint as id_funcion, f.id_pelicula::bigint as id_pelicula,
             x.total, x.entradas, x.pagado, (x.pagable and x.pagado > 0) as es_venta
        from res x
        join public.funcion f on f.id = x.id_funcion
       where coalesce(f.activa, false)
         and (p_desde is null or f.fecha::date >= p_desde)
         and (p_hasta is null or f.fecha::date <= p_hasta)
         and (p_pelicula is null or f.id_pelicula = p_pelicula)
    )
    select pe.id::bigint, pe.titulo::text, null::bigint, null::date, null::time, null::text,
           (count(distinct d.id_funcion))::integer,
           count(*)::integer,
           coalesce(sum(d.entradas), 0)::integer,
           coalesce(sum(d.total), 0)::numeric,
           (count(*) filter (where d.es_venta))::integer,
           coalesce(sum(d.entradas) filter (where d.es_venta), 0)::integer,
           coalesce(sum(d.pagado) filter (where d.es_venta), 0)::numeric
      from det d
      left join public.pelicula pe on pe.id = d.id_pelicula
     group by pe.id, pe.titulo
     order by pe.titulo, pe.id;
  end if;
end;
$$;

revoke all on function public.reporte_ventas_reservas(date, date, text, bigint) from public, anon, authenticated;
grant execute on function public.reporte_ventas_reservas(date, date, text, bigint) to service_role;
