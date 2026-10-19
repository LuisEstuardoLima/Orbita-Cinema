-- =====================================================================
-- Órbita Cinema · Sprint 4 · SCRUM-139
-- Configuración del porcentaje de recargo
--
-- Objetivos:
--   1) Guardar persistentemente el porcentaje de recargo.
--   2) Conservar 5 % como valor inicial.
--   3) Evitar escrituras directas desde el navegador.
--   4) Hacer que el RPC que crea la reserva consulte directamente:
--        - el porcentaje configurado;
--        - los precios vigentes de la sala.
--
-- De esta manera, los importes de una compra no dependen de precios,
-- porcentajes, subtotales o totales enviados por el navegador.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Configuración global
-- ---------------------------------------------------------------------

create table if not exists public.configuracion_sistema (
  id smallint primary key default 1
    constraint configuracion_sistema_unica
    check (id = 1),

  porcentaje_recargo numeric(5,2) not null default 5.00
    constraint configuracion_sistema_recargo_chk
    check (
      porcentaje_recargo >= 0
      and porcentaje_recargo <= 100
    ),

  updated_at timestamptz not null default now()
);

comment on table public.configuracion_sistema is
'Configuración global de Órbita Cinema. Solo debe existir el registro con id = 1.';

comment on column public.configuracion_sistema.porcentaje_recargo is
'Porcentaje de recargo aplicado por el servidor a las nuevas compras.';


-- Valor inicial requerido por SCRUM-139.
-- No sobrescribe configuraciones existentes.
insert into public.configuracion_sistema (
  id,
  porcentaje_recargo
)
values (
  1,
  5.00
)
on conflict (id) do nothing;


-- La tabla no debe poder modificarse directamente desde el navegador.
alter table public.configuracion_sistema
  enable row level security;


-- ---------------------------------------------------------------------
-- 2. Integridad del cálculo de una nueva reserva
-- ---------------------------------------------------------------------
--
-- Se conserva temporalmente la firma existente de bloquear_asientos
-- para mantener compatibilidad con el código actual:
--
--   p_precios
--   p_porcentaje
--
-- siguen llegando como argumentos, pero YA NO son fuentes de verdad.
--
-- PostgreSQL vuelve a obtener:
--   - los precios desde public.sala;
--   - el porcentaje desde public.configuracion_sistema.
--
-- Esto evita que una solicitud alterada pueda cambiar los importes.
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
returns table (
  out_id_reserva bigint,
  out_segundos integer
)
language plpgsql
as $$
declare
  v_sala        bigint;
  v_n           integer;

  v_precio_adulto       numeric;
  v_precio_tercera_edad numeric;
  v_precio_nino         numeric;

  v_porcentaje numeric;
  v_subtotal   numeric;
  v_recargo    numeric;

  v_id         bigint;
  v_exp        timestamptz;
begin

  -- ---------------------------------------------------------------
  -- 1. Validación estructural de la solicitud
  -- ---------------------------------------------------------------

  if p_funcion is null
     or p_token is null
     or coalesce(array_length(p_asientos, 1), 0) = 0
     or array_length(p_asientos, 1)
        <> coalesce(array_length(p_tipos, 1), -1)
     or (
       select count(distinct a)
       from unnest(p_asientos) a
     ) <> array_length(p_asientos, 1)
  then
    raise exception 'datos_invalidos';
  end if;


  -- Solo se aceptan tipos de entrada conocidos por el sistema.
  if exists (
    select 1
    from unnest(p_tipos) as t(tipo)
    where t.tipo not in (
      'adulto',
      'tercera_edad',
      'nino'
    )
  ) then
    raise exception 'datos_invalidos';
  end if;


  -- ---------------------------------------------------------------
  -- 2. Función y precios vigentes
  -- ---------------------------------------------------------------

  select
    f.id_sala,
    s.precio_adulto,
    s.precio_tercera_edad,
    s.precio_nino
  into
    v_sala,
    v_precio_adulto,
    v_precio_tercera_edad,
    v_precio_nino
  from public.funcion f
  join public.sala s
    on s.id = f.id_sala
  where f.id = p_funcion
    and f.activa = true
    and s.activa = true;

  if v_sala is null then
    raise exception 'funcion_no_disponible';
  end if;


  if v_precio_adulto is null
     or v_precio_adulto <= 0
     or v_precio_tercera_edad is null
     or v_precio_tercera_edad <= 0
     or v_precio_nino is null
     or v_precio_nino <= 0
  then
    raise exception 'precios_no_disponibles';
  end if;


  -- ---------------------------------------------------------------
  -- 3. Porcentaje vigente
  -- ---------------------------------------------------------------

  select c.porcentaje_recargo
  into v_porcentaje
  from public.configuracion_sistema c
  where c.id = 1;

  if v_porcentaje is null
     or v_porcentaje < 0
     or v_porcentaje > 100
  then
    raise exception 'configuracion_recargo_invalida';
  end if;


  -- ---------------------------------------------------------------
  -- 4. Liberar bloqueos vencidos de esta función
  -- ---------------------------------------------------------------

  with vencidas as (
    update public.reserva r
       set estado = 'expirada',
           updated_at = now()
     where r.id_funcion = p_funcion
       and r.estado = 'pendiente_pago'
       and r.fecha_expiracion <= now()
    returning r.id_reserva
  )
  update public.detalle_reserva d
     set estado = 'liberado'
    from vencidas v
   where d.id_reserva = v.id_reserva
     and d.estado = 'bloqueado';


  -- ---------------------------------------------------------------
  -- 5. Liberar bloqueo anterior del mismo cliente
  -- ---------------------------------------------------------------

  with previas as (
    update public.reserva r
       set estado = 'cancelada_cliente',
           updated_at = now()
     where r.token_sesion = p_token
       and r.estado = 'pendiente_pago'
    returning r.id_reserva
  )
  update public.detalle_reserva d
     set estado = 'liberado'
    from previas v
   where d.id_reserva = v.id_reserva
     and d.estado = 'bloqueado';


  -- ---------------------------------------------------------------
  -- 6. Validar los asientos
  -- ---------------------------------------------------------------

  select count(*)
  into v_n
  from public.asiento a
  where a.id = any (p_asientos)
    and a.id_sala = v_sala
    and a.estado = 'normal';

  if v_n <> array_length(p_asientos, 1) then
    raise exception 'asiento_invalido';
  end if;


  -- ---------------------------------------------------------------
  -- 7. Calcular precios dentro de PostgreSQL
  -- ---------------------------------------------------------------
  --
  -- IMPORTANTE:
  -- p_precios y p_porcentaje se ignoran deliberadamente.
  --
  -- El subtotal se calcula exclusivamente a partir del tipo de entrada
  -- y los precios vigentes almacenados en public.sala.
  -- ---------------------------------------------------------------

  select
    coalesce(
      sum(
        case t.tipo
          when 'adulto'
            then v_precio_adulto

          when 'tercera_edad'
            then v_precio_tercera_edad

          when 'nino'
            then v_precio_nino

          else 0
        end
      ),
      0
    )
  into v_subtotal
  from unnest(p_tipos) as t(tipo);


  v_recargo :=
    round(
      v_subtotal * v_porcentaje / 100,
      2
    );


  -- ---------------------------------------------------------------
  -- 8. Crear la reserva con snapshot de los importes
  -- ---------------------------------------------------------------

  insert into public.reserva (
    id_usuario,
    id_funcion,
    nombre_comprador,
    correo_comprador,
    telefono_comprador,
    subtotal,
    porcentaje_recargo,
    monto_recargo,
    total,
    estado,
    token_sesion
  )
  values (
    p_usuario,
    p_funcion,
    p_nombre,
    p_correo,
    p_telefono,
    v_subtotal,
    v_porcentaje,
    v_recargo,
    v_subtotal + v_recargo,
    'pendiente_pago',
    p_token
  )
  returning
    id_reserva,
    fecha_expiracion
  into
    v_id,
    v_exp;


  -- ---------------------------------------------------------------
  -- 9. Crear detalle con el precio validado por PostgreSQL
  -- ---------------------------------------------------------------

  begin
    insert into public.detalle_reserva (
      id_reserva,
      id_funcion,
      id_asiento,
      tipo_entrada,
      precio,
      estado
    )
    select
      v_id,
      p_funcion,
      u.asiento,
      u.tipo,

      case u.tipo
        when 'adulto'
          then v_precio_adulto

        when 'tercera_edad'
          then v_precio_tercera_edad

        when 'nino'
          then v_precio_nino
      end,

      'bloqueado'

    from unnest(
      p_asientos,
      p_tipos
    ) as u(
      asiento,
      tipo
    );

  exception
    when unique_violation then
      raise exception 'asiento_ocupado';
  end;


  -- ---------------------------------------------------------------
  -- 10. Resultado
  -- ---------------------------------------------------------------

  return query
  select
    v_id,
    greatest(
      0,
      ceil(
        extract(
          epoch from (
            v_exp - now()
          )
        )
      )
    )::integer;

end;
$$;