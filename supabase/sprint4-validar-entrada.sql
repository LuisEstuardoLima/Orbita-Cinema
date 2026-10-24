-- =====================================================================
-- Órbita Cinema · Sprint 4 · SCRUM-140 · validar_entrada
-- Ejecutar en Supabase > SQL Editor (después de sprint3-confirmar-compra.sql).
-- Es idempotente: add column if not exists + create or replace function.
--
-- Valida el ingreso de un cliente a la sala a partir de UNO de estos datos:
--   · el código del QR del boleto (boleto.codigo_qr),
--   · el ID de entrada (boleto.id_boleto), o
--   · el número de reserva (reserva.id_reserva).
-- Hay un solo QR por reserva, así que validar uno marca TODA la reserva como utilizada.
--
-- Comprobaciones, en este orden (la primera que falla rechaza y NO cambia nada):
--   1) la reserva existe                       -> no_encontrada
--   2) corresponde a la función seleccionada   -> otra_funcion
--   3) no está cancelada (ni su función)       -> cancelada
--   4) no fue utilizada antes                  -> ya_utilizada
--   5) está pagada (confirmada)                -> no_pagada
-- Si todo se cumple: reserva -> 'usada' y boleto.fecha_uso = now(), en la MISMA transacción.
--
-- Atómica: la reserva se lee con FOR UPDATE, así que dos validaciones simultáneas de la misma
-- reserva se serializan; la segunda ve 'usada' y recibe 'ya_utilizada'. Cualquier error
-- inesperado revierte todo (la reserva no queda como utilizada).
--
-- Solo la llama el backend con service_role (nunca el navegador); el rol del usuario
-- (Colaborador/Administrador) se verifica en la Server Action antes de llegar aquí.
-- =====================================================================

-- Quién validó el ingreso (auditoría). Nullable: la validación no depende de este dato.
alter table public.boleto add column if not exists validado_por uuid;

-- Se recrea siempre: Postgres no permite quitar/cambiar los valores por defecto de los parámetros
-- con create or replace (error 42P13), y la firma cambió al hacer opcional p_funcion.
drop function if exists public.validar_entrada(bigint, uuid, bigint, bigint, uuid);

create or replace function public.validar_entrada(
  p_funcion    bigint,
  p_codigo_qr  uuid default null,
  p_id_boleto  bigint default null,
  p_id_reserva bigint default null,
  p_validador  uuid default null
)
returns jsonb
language plpgsql
as $$
declare
  v_id_reserva bigint;
  v_r          public.reserva%rowtype;
  v_b          public.boleto%rowtype;
  v_f          public.funcion%rowtype;
  v_motivo     text;
  v_info       jsonb;
  v_uso        timestamptz;
begin
  -- Exactamente un dato de búsqueda.
  if p_funcion is null
     or (case when p_codigo_qr  is null then 0 else 1 end
       + case when p_id_boleto  is null then 0 else 1 end
       + case when p_id_reserva is null then 0 else 1 end) <> 1 then
    raise exception 'datos_invalidos';
  end if;

  -- 1) Localizar la reserva a partir del QR, del ID de entrada o del número de reserva.
  if p_codigo_qr is not null then
    select b.id_reserva into v_id_reserva from public.boleto b where b.codigo_qr = p_codigo_qr;
  elsif p_id_boleto is not null then
    select b.id_reserva into v_id_reserva from public.boleto b where b.id_boleto = p_id_boleto;
  else
    select r.id_reserva into v_id_reserva from public.reserva r where r.id_reserva = p_id_reserva;
  end if;

  if v_id_reserva is null then
    return jsonb_build_object('ok', false, 'motivo', 'no_encontrada');
  end if;

  -- Bloqueo de la reserva: desde aquí, otra validación de la misma reserva espera.
  select * into v_r from public.reserva where id_reserva = v_id_reserva for update;
  if not found then
    return jsonb_build_object('ok', false, 'motivo', 'no_encontrada');
  end if;

  select * into v_b from public.boleto where id_reserva = v_r.id_reserva;
  select * into v_f from public.funcion where id = v_r.id_funcion;

  -- Datos para mostrar (también cuando se rechaza). id_compra = id de la reserva (RF-060).
  v_info := jsonb_build_object(
    'id_compra',     v_r.id_reserva,
    'id_entrada',    v_b.id_boleto,
    'comprador',     v_r.nombre_comprador,
    'total',         v_r.total,
    'estado',        v_r.estado,
    'id_funcion',    v_r.id_funcion,
    'fecha_funcion', v_f.fecha,
    'hora_funcion',  v_f.hora,
    'fecha_uso',     v_b.fecha_uso,
    'asientos', coalesce((
      select jsonb_agg(a.fila || a.numero order by a.fila, a.numero)
        from public.detalle_reserva d
        join public.asiento a on a.id = d.id_asiento
       where d.id_reserva = v_r.id_reserva
         and d.estado in ('bloqueado', 'reservado')
    ), '[]'::jsonb)
  );

  -- 2..5) Comprobaciones. La primera que falla rechaza sin modificar nada.
  if v_r.id_funcion <> p_funcion then
    v_motivo := 'otra_funcion';
  elsif v_r.estado in ('cancelada_cliente', 'cancelada_funcion') or coalesce(v_f.activa, false) = false then
    v_motivo := 'cancelada';
  elsif v_r.estado = 'usada' or v_b.fecha_uso is not null then
    v_motivo := 'ya_utilizada';
  elsif v_r.estado <> 'confirmada' or v_b.id_boleto is null then
    v_motivo := 'no_pagada'; -- pendiente_pago o expirada: nunca se pagó
  end if;

  if v_motivo is not null then
    return jsonb_build_object('ok', false, 'motivo', v_motivo) || v_info;
  end if;

  -- Éxito: toda la reserva queda utilizada, de una sola vez.
  update public.reserva set estado = 'usada', updated_at = now() where id_reserva = v_r.id_reserva;
  update public.boleto set fecha_uso = now(), validado_por = p_validador where id_boleto = v_b.id_boleto
  returning fecha_uso into v_uso;

  return jsonb_build_object('ok', true, 'motivo', null) || v_info
         || jsonb_build_object('estado', 'usada', 'fecha_uso', v_uso);
end;
$$;

revoke all on function public.validar_entrada(bigint, uuid, bigint, bigint, uuid) from public, anon, authenticated;
grant execute on function public.validar_entrada(bigint, uuid, bigint, bigint, uuid) to service_role;
