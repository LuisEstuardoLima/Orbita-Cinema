-- =====================================================================
-- Órbita Cinema · SCRUM-135 · Consulta administrativa de entradas
--
-- Listado y detalle de entradas/reservas vendidas.
--
-- IMPORTANTE:
--   · Solo consulta información existente.
--   · No crea reservas, boletos ni entradas.
--   · No modifica estados.
--   · La validación y cambio a "usada" pertenece a SCRUM-136/140.
--   · El listado paginado usa 50 filas por página (máximo permitido: 100).
--
-- Las funciones solo quedan disponibles para service_role.
-- El acceso por rol se verifica además desde Next.js.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. LISTADO GENERAL
-- ---------------------------------------------------------------------

drop function if exists public.listar_entradas_admin(text);

create or replace function public.listar_entradas_admin(
  p_busqueda text default null
)
returns table (
  id_reserva bigint,
  nombre_comprador text,
  pelicula text,
  fecha_funcion date,
  hora_funcion text,
  sala text,
  asientos text[],
  cantidad_asientos bigint,
  estado_reserva text,
  fecha_uso timestamptz,
  fecha_reserva timestamptz
)
language sql
stable
as $$
  select
    r.id_reserva,
    r.nombre_comprador,
    coalesce(p.titulo, '—') as pelicula,
    f.fecha as fecha_funcion,
    case
      when f.hora is null then null
      else left(f.hora::text, 5)
    end as hora_funcion,
    coalesce(s.nombre, '—') as sala,

    coalesce(
      array_agg(
        a.fila || a.numero
        order by a.fila, a.numero
      ) filter (where a.id is not null),
      array[]::text[]
    ) as asientos,

    count(d.id_detalle) as cantidad_asientos,

    r.estado as estado_reserva,
    b.fecha_uso,
    r.fecha_reserva

  from public.reserva r

  inner join public.boleto b
    on b.id_reserva = r.id_reserva

  inner join public.funcion f
    on f.id = r.id_funcion

  left join public.pelicula p
    on p.id = f.id_pelicula

  left join public.sala s
    on s.id = f.id_sala

  left join public.detalle_reserva d
    on d.id_reserva = r.id_reserva

  left join public.asiento a
    on a.id = d.id_asiento

  where
    (
      coalesce(trim(p_busqueda), '') = ''

      or r.nombre_comprador ilike
        '%' || trim(p_busqueda) || '%'

      or (
        regexp_replace(
          coalesce(p_busqueda, ''),
          '[^0-9]',
          '',
          'g'
        ) <> ''

        and r.id_reserva =
          regexp_replace(
            p_busqueda,
            '[^0-9]',
            '',
            'g'
          )::bigint
      )
    )

  group by
    r.id_reserva,
    r.nombre_comprador,
    p.titulo,
    f.fecha,
    f.hora,
    s.nombre,
    r.estado,
    b.fecha_uso,
    r.fecha_reserva

  order by r.fecha_reserva desc, r.id_reserva desc;
$$;


revoke all
on function public.listar_entradas_admin(text)
from public, anon, authenticated;

grant execute
on function public.listar_entradas_admin(text)
to service_role;


-- ---------------------------------------------------------------------
-- 1b. LISTADO GENERAL PAGINADO
-- ---------------------------------------------------------------------

create or replace function public.listar_entradas_admin_paginado(
  p_busqueda text default null,
  p_pagina integer default 1,
  p_por_pagina integer default 50
)
returns jsonb
language plpgsql
stable
as $$
declare
  v_pagina_solicitada integer := greatest(coalesce(p_pagina, 1), 1);
  v_por_pagina integer := greatest(least(coalesce(p_por_pagina, 50), 100), 1);
begin
  return (
    with coincidencias as materialized (
      select
        r.id_reserva,
        r.nombre_comprador,
        coalesce(p.titulo, '—') as pelicula,
        f.fecha as fecha_funcion,
        case
          when f.hora is null then null
          else left(f.hora::text, 5)
        end as hora_funcion,
        coalesce(s.nombre, '—') as sala,
        coalesce(
          array_agg(
            a.fila || a.numero
            order by a.fila, a.numero
          ) filter (where a.id is not null),
          array[]::text[]
        ) as asientos,
        count(d.id_detalle) as cantidad_asientos,
        r.estado as estado_reserva,
        b.fecha_uso,
        r.fecha_reserva
      from public.reserva r
      inner join public.boleto b
        on b.id_reserva = r.id_reserva
      inner join public.funcion f
        on f.id = r.id_funcion
      left join public.pelicula p
        on p.id = f.id_pelicula
      left join public.sala s
        on s.id = f.id_sala
      left join public.detalle_reserva d
        on d.id_reserva = r.id_reserva
      left join public.asiento a
        on a.id = d.id_asiento
      where
        (
          coalesce(trim(p_busqueda), '') = ''
          or r.nombre_comprador ilike '%' || trim(p_busqueda) || '%'
          or (
            regexp_replace(coalesce(p_busqueda, ''), '[^0-9]', '', 'g') <> ''
            and r.id_reserva = regexp_replace(
              p_busqueda,
              '[^0-9]',
              '',
              'g'
            )::bigint
          )
        )
      group by
        r.id_reserva,
        r.nombre_comprador,
        p.titulo,
        f.fecha,
        f.hora,
        s.nombre,
        r.estado,
        b.fecha_uso,
        r.fecha_reserva
    ),
    resumen as (
      select count(*) as total
      from coincidencias
    ),
    paginacion as (
      select
        total,
        greatest(ceil(total::numeric / v_por_pagina)::integer, 1) as total_paginas,
        least(
          v_pagina_solicitada,
          greatest(ceil(total::numeric / v_por_pagina)::integer, 1)
        ) as pagina
      from resumen
    ),
    pagina as (
      select c.*
      from coincidencias c
      cross join paginacion pg
      order by c.fecha_reserva desc, c.id_reserva desc
      limit v_por_pagina
      offset ((select pg.pagina from paginacion pg)::bigint - 1) * v_por_pagina
    )
    select jsonb_build_object(
      'total', pg.total,
      'pagina', pg.pagina,
      'por_pagina', v_por_pagina,
      'total_paginas', pg.total_paginas,
      'filas', coalesce(
        (
          select jsonb_agg(
            jsonb_build_object(
              'id_reserva', pagina.id_reserva,
              'nombre_comprador', pagina.nombre_comprador,
              'pelicula', pagina.pelicula,
              'fecha_funcion', pagina.fecha_funcion,
              'hora_funcion', pagina.hora_funcion,
              'sala', pagina.sala,
              'asientos', pagina.asientos,
              'cantidad_asientos', pagina.cantidad_asientos,
              'estado_reserva', pagina.estado_reserva,
              'fecha_uso', pagina.fecha_uso,
              'fecha_reserva', pagina.fecha_reserva
            )
            order by pagina.fecha_reserva desc, pagina.id_reserva desc
          )
          from pagina
        ),
        '[]'::jsonb
      )
    )
    from paginacion pg
  );
end;
$$;

revoke all
on function public.listar_entradas_admin_paginado(text, integer, integer)
from public, anon, authenticated;

grant execute
on function public.listar_entradas_admin_paginado(text, integer, integer)
to service_role;


-- ---------------------------------------------------------------------
-- 2. DETALLE DE UNA RESERVA
-- ---------------------------------------------------------------------

drop function if exists public.detalle_entrada_admin(bigint);

create or replace function public.detalle_entrada_admin(
  p_id_reserva bigint
)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'id_reserva',
    r.id_reserva,

    'nombre_comprador',
    r.nombre_comprador,

    'correo_comprador',
    r.correo_comprador,

    'telefono_comprador',
    r.telefono_comprador,

    'fecha_reserva',
    r.fecha_reserva,

    'total',
    r.total,

    'estado_reserva',
    r.estado,

    'id_boleto',
    b.id_boleto,

    'fecha_uso',
    b.fecha_uso,

    'funcion',
    jsonb_build_object(
      'id',
      f.id,

      'pelicula',
      coalesce(p.titulo, '—'),

      'fecha',
      f.fecha,

      'hora',
      case
        when f.hora is null then null
        else left(f.hora::text, 5)
      end,

      'sala',
      coalesce(s.nombre, '—')
    ),

    'entradas',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id_detalle',
            d.id_detalle,

            'asiento',
            a.fila || a.numero,

            'tipo_entrada',
            d.tipo_entrada,

            'precio',
            d.precio,

            'estado_detalle',
            d.estado
          )
          order by a.fila, a.numero
        )

        from public.detalle_reserva d

        inner join public.asiento a
          on a.id = d.id_asiento

        where d.id_reserva = r.id_reserva
      ),
      '[]'::jsonb
    )
  )

  from public.reserva r

  inner join public.boleto b
    on b.id_reserva = r.id_reserva

  inner join public.funcion f
    on f.id = r.id_funcion

  left join public.pelicula p
    on p.id = f.id_pelicula

  left join public.sala s
    on s.id = f.id_sala

  where r.id_reserva = p_id_reserva

  limit 1;
$$;


revoke all
on function public.detalle_entrada_admin(bigint)
from public, anon, authenticated;

grant execute
on function public.detalle_entrada_admin(bigint)
to service_role;

notify pgrst, 'reload schema';