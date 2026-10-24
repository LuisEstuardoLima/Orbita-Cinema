-- =====================================================================
-- Órbita Cinema · Sprint 4 · SCRUM-143 · reporte_ocupacion_funcion
-- Ejecutar en Supabase > SQL Editor (después de sprint3-bloqueo-asientos.sql).
-- Es idempotente: create or replace function. NO crea tablas ni copia datos: lee funcion,
-- pelicula, sala, asiento, reserva y detalle_reserva, y no modifica nada (solo SELECT).
--
-- Devuelve (jsonb) la ocupación de UNA función: datos de la función, indicadores y el detalle de
-- cada asiento. Devuelve NULL si la función no existe (la app muestra "sin resultados").
--
-- Definiciones:
--   · Asientos de la función = los de su sala con estado 'normal' (los vendibles). Si un asiento
--     ya no es 'normal' pero tiene una reserva en esa función (p. ej. se reconfiguró el plano
--     después), se incluye igual: así el histórico no pierde ocupados.
--   · CAPACIDAD = cantidad de esos asientos. OCUPADOS + DISPONIBLES = CAPACIDAD siempre, porque
--     los indicadores se cuentan sobre las mismas filas del detalle.
--   · OCUPADO = asiento con detalle 'reservado' (compra pagada), o 'bloqueado' por una compra en
--     curso cuyo bloqueo todavía no vence (es lo mismo que ven los clientes en el mapa de
--     asientos). Un bloqueo vencido, cancelado o liberado deja el asiento LIBRE.
--     Se informa también cuántos son reservados y cuántos están en compra.
--   · PORCENTAJE = ocupados / capacidad * 100, con 2 decimales (0 si la capacidad es 0).
--
-- Solo la llama el backend con service_role; el rol Administrador se verifica en el servidor.
-- =====================================================================

create or replace function public.reporte_ocupacion_funcion(p_funcion bigint)
returns jsonb
language plpgsql
stable
as $$
declare
  v_f        record;
  v_cap      integer;
  v_ocup     integer;
  v_res      integer;
  v_comp     integer;
  v_asientos jsonb;
begin
  if p_funcion is null then
    raise exception 'datos_invalidos';
  end if;

  select f.id::bigint as id, f.fecha::date as fecha, f.hora::time as hora,
         coalesce(f.activa, false) as activa, f.id_sala::bigint as id_sala,
         f.id_pelicula::bigint as id_pelicula, pe.titulo::text as pelicula, sa.nombre::text as sala
    into v_f
    from public.funcion f
    left join public.pelicula pe on pe.id = f.id_pelicula
    left join public.sala sa on sa.id = f.id_sala
   where f.id = p_funcion;

  if not found then
    return null;
  end if;

  with ocupados as (
    select d.id_asiento,
           bool_or(d.estado = 'reservado') as reservado
      from public.detalle_reserva d
      join public.reserva r on r.id_reserva = d.id_reserva
     where d.id_funcion = p_funcion
       and (d.estado = 'reservado'
            or (d.estado = 'bloqueado'
                and r.estado = 'pendiente_pago'
                and r.fecha_expiracion > now()))
     group by d.id_asiento
  ), filas as (
    select a.fila::text as fila, a.numero::integer as numero,
           (o.id_asiento is not null) as ocupado,
           coalesce(o.reservado, false) as reservado
      from public.asiento a
      left join ocupados o on o.id_asiento = a.id
     where a.id_sala = v_f.id_sala
       and (a.estado = 'normal' or o.id_asiento is not null)
  )
  select count(*)::integer,
         (count(*) filter (where ocupado))::integer,
         (count(*) filter (where ocupado and reservado))::integer,
         (count(*) filter (where ocupado and not reservado))::integer,
         coalesce(jsonb_agg(jsonb_build_object(
                    'fila', fila,
                    'numero', numero,
                    'estado', case when ocupado then 'ocupado' else 'libre' end,
                    'origen', case when not ocupado then null
                                   when reservado then 'reservado'
                                   else 'en_compra' end)
                  order by fila, numero), '[]'::jsonb)
    into v_cap, v_ocup, v_res, v_comp, v_asientos
    from filas;

  return jsonb_build_object(
    'funcion', jsonb_build_object(
      'id', v_f.id, 'id_pelicula', v_f.id_pelicula, 'pelicula', v_f.pelicula,
      'fecha', v_f.fecha, 'hora', v_f.hora, 'id_sala', v_f.id_sala, 'sala', v_f.sala,
      'activa', v_f.activa),
    'resumen', jsonb_build_object(
      'capacidad', v_cap,
      'ocupados', v_ocup,
      'reservados', v_res,
      'en_compra', v_comp,
      'disponibles', v_cap - v_ocup,
      'porcentaje', case when v_cap > 0 then round(v_ocup * 100.0 / v_cap, 2) else 0 end),
    'asientos', v_asientos);
end;
$$;

revoke all on function public.reporte_ocupacion_funcion(bigint) from public, anon, authenticated;
grant execute on function public.reporte_ocupacion_funcion(bigint) to service_role;
