-- =====================================================================
-- Órbita Cinema · SCRUM-136 · Personas con reserva por función y sala
--
-- Consulta administrativa de asistentes asociados a una función.
--
-- IMPORTANTE:
--   · Solo lee información existente.
--   · No crea ni duplica reservas, boletos o asientos.
--   · No modifica estados.
--   · La validación y el cambio a "usada" corresponden a SCRUM-140.
--
-- El acceso desde la aplicación se limita a Colaborador y Administrador.
-- La función SQL solamente queda disponible para service_role.
-- =====================================================================

create or replace function public.listar_asistentes_funcion_admin(
  p_funcion bigint,
  p_tipo_busqueda text default null,
  p_busqueda text default null
)
returns table (
  id_reserva bigint,
  id_boleto bigint,
  nombre_comprador text,
  correo_comprador text,
  telefono_comprador text,
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
    b.id_boleto,
    r.nombre_comprador,
    r.correo_comprador,
    r.telefono_comprador,

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

  -- Una entrada vendida tiene boleto generado.
  -- Las reservas canceladas o utilizadas conservan ese boleto
  -- y por eso siguen disponibles para consulta histórica.
  inner join public.boleto b
    on b.id_reserva = r.id_reserva

  left join public.detalle_reserva d
    on d.id_reserva = r.id_reserva

  left join public.asiento a
    on a.id = d.id_asiento

  where
    r.id_funcion = p_funcion

    and (
      coalesce(trim(p_busqueda), '') = ''

      or (
        p_tipo_busqueda = 'entrada'
        and regexp_replace(
          coalesce(p_busqueda, ''),
          '[^0-9]',
          '',
          'g'
        ) <> ''
        and b.id_boleto =
          regexp_replace(
            p_busqueda,
            '[^0-9]',
            '',
            'g'
          )::bigint
      )

      or (
        p_tipo_busqueda = 'nombre'
        and r.nombre_comprador ilike
          '%' || trim(p_busqueda) || '%'
      )

      or (
        p_tipo_busqueda = 'correo'
        and r.correo_comprador ilike
          '%' || trim(p_busqueda) || '%'
      )
    )

  group by
    r.id_reserva,
    b.id_boleto,
    r.nombre_comprador,
    r.correo_comprador,
    r.telefono_comprador,
    r.estado,
    b.fecha_uso,
    r.fecha_reserva

  order by
    r.nombre_comprador,
    r.id_reserva;
$$;

revoke all
on function public.listar_asistentes_funcion_admin(bigint, text, text)
from public, anon, authenticated;

grant execute
on function public.listar_asistentes_funcion_admin(bigint, text, text)
to service_role;