-- =====================================================================
-- Órbita Cinema · Correcciones de distribución y mapas de asientos
-- Ejecutar en Supabase > SQL Editor después de los scripts de reservas y
-- reportes. Conserva las filas referenciadas por detalle_reserva.
-- =====================================================================

alter table public.asiento
  add column if not exists retirado boolean not null default false;

comment on column public.asiento.retirado is
  'La posición ya no forma parte de la distribución activa. Se conserva para mantener las referencias y el histórico de reservas.';

create or replace function public.guardar_distribucion_asientos(
  p_sala bigint,
  p_distribucion jsonb
)
returns integer
language plpgsql
as $$
declare
  v_asiento record;
  v_numero_filas integer;
  v_coordenadas_unicas integer;
  v_disponibles integer;
  v_actualizados integer;
begin
  if p_sala is null or p_sala <= 0 or p_distribucion is null then
    raise exception 'datos_invalidos';
  end if;

  if jsonb_typeof(p_distribucion) <> 'array' then
    raise exception 'datos_invalidos';
  end if;

  if jsonb_array_length(p_distribucion) = 0 then
    raise exception 'datos_invalidos';
  end if;

  perform 1
    from public.sala
   where id = p_sala
   for update;
  if not found then
    raise exception 'sala_no_encontrada';
  end if;

  if exists (
    select 1
      from public.funcion
     where id_sala = p_sala
       and activa = true
       and fecha >= (now() at time zone 'America/Guatemala')::date
  ) then
    raise exception 'sala_con_funciones_activas';
  end if;

  select count(*)::integer,
         count(distinct (x.fila, x.numero))::integer
    into v_numero_filas, v_coordenadas_unicas
    from jsonb_to_recordset(p_distribucion)
      as x(fila text, numero integer, estado text);

  if v_numero_filas <> jsonb_array_length(p_distribucion)
     or v_numero_filas > 350
     or v_coordenadas_unicas <> v_numero_filas
     or exists (
       select 1
         from jsonb_to_recordset(p_distribucion)
           as x(fila text, numero integer, estado text)
        where x.fila is null
           or x.numero is null
           or x.estado is null
           or x.fila !~ '^[A-N]$'
           or x.numero not between 1 and 25
           or x.estado not in ('normal', 'pasillo', 'deshabilitado')
     ) then
    raise exception 'distribucion_invalida';
  end if;

  select count(*)::integer
    into v_disponibles
    from jsonb_to_recordset(p_distribucion)
      as x(fila text, numero integer, estado text)
   where x.estado = 'normal';

  if v_disponibles > 200 then
    raise exception 'capacidad_excedida';
  end if;

  update public.asiento
     set retirado = true
   where id_sala = p_sala
     and retirado = false;

  for v_asiento in
    select x.fila, x.numero, x.estado
      from jsonb_to_recordset(p_distribucion)
        as x(fila text, numero integer, estado text)
  loop
    update public.asiento
       set estado = v_asiento.estado,
           retirado = false
     where id_sala = p_sala
       and fila = v_asiento.fila
       and numero = v_asiento.numero;

    get diagnostics v_actualizados = row_count;
    if v_actualizados = 0 then
      insert into public.asiento (id_sala, fila, numero, estado, retirado)
      values (p_sala, v_asiento.fila, v_asiento.numero, v_asiento.estado, false);
    end if;
  end loop;

  update public.sala
     set capacidad = v_disponibles
   where id = p_sala;

  return v_disponibles;
end;
$$;

revoke all on function public.guardar_distribucion_asientos(bigint, jsonb)
  from public, anon, authenticated;
grant execute on function public.guardar_distribucion_asientos(bigint, jsonb)
  to service_role;

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
                      jsonb_agg(
                        jsonb_build_object(
                          'id', a.id,
                          'fila', a.fila,
                          'numero', (
                            select count(*)::integer
                              from public.asiento visible
                             where visible.id_sala = a.id_sala
                               and visible.fila = a.fila
                               and visible.estado = 'normal'
                               and visible.retirado = false
                               and visible.numero <= a.numero
                          )
                        )
                        order by a.fila, a.numero
                      ),
                      '[]'::jsonb
                    )
               from public.detalle_reserva d
               join public.asiento a on a.id = d.id_asiento
              where d.id_reserva = r.id_reserva
                and d.estado = 'bloqueado'
                and a.estado = 'normal'
                and a.retirado = false
           )
         )
    from public.reserva r
   where r.token_sesion = p_token
     and r.estado = 'pendiente_pago'
     and r.fecha_expiracion > now()
   order by r.id_reserva desc
   limit 1;
$$;

revoke all on function public.bloqueo_vigente(uuid)
  from public, anon, authenticated;
grant execute on function public.bloqueo_vigente(uuid)
  to service_role;

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
    select a.fila::text as fila,
           case
             when a.estado = 'normal' and a.retirado = false then (
               select count(*)::integer
                 from public.asiento visible
                where visible.id_sala = a.id_sala
                  and visible.fila = a.fila
                  and visible.estado = 'normal'
                  and visible.retirado = false
                  and visible.numero <= a.numero
             )
             else a.numero::integer
           end as numero,
           a.numero::integer as columna,
           case when a.retirado then 'retirado' else a.estado end::text as tipo,
           (o.id_asiento is not null) as ocupado,
           coalesce(o.reservado, false) as reservado
      from public.asiento a
      left join ocupados o on o.id_asiento = a.id
     where a.id_sala = v_f.id_sala
       and (a.retirado = false or o.id_asiento is not null)
  )
  select count(*) filter (where tipo = 'normal' or ocupado)::integer,
         count(*) filter (where ocupado)::integer,
         count(*) filter (where ocupado and reservado)::integer,
         count(*) filter (where ocupado and not reservado)::integer,
         coalesce(jsonb_agg(jsonb_build_object(
                    'fila', fila,
                    'numero', numero,
                    'columna', columna,
                    'tipo', tipo,
                    'estado', case when ocupado then 'ocupado'
                                   when tipo = 'normal' then 'libre'
                                   else 'no_aplica' end,
                    'origen', case when not ocupado then null
                                   when reservado then 'reservado'
                                   else 'en_compra' end)
                  order by fila, columna), '[]'::jsonb)
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

revoke all on function public.reporte_ocupacion_funcion(bigint)
  from public, anon, authenticated;
grant execute on function public.reporte_ocupacion_funcion(bigint)
  to service_role;

notify pgrst, 'reload schema';
