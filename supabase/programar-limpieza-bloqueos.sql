-- =====================================================================
-- Órbita Cinema · LIMPIEZA AUTOMÁTICA DE BLOQUEOS VENCIDOS (pg_cron)
--
-- Programa `public.liberar_bloqueos_vencidos()` (definida en
-- sprint3-bloqueo-asientos.sql) cada 5 minutos para marcar como
-- 'expirada' las reservas 'pendiente_pago' cuya fecha_expiración ya pasó
-- y pasar sus detalles 'bloqueado' a 'liberado'.
--
-- REQUISITO PREVIO (una sola vez, en Supabase Dashboard):
--   Database > Extensions > buscar "pg_cron" > Enable.
--
-- Este archivo es INDEPENDIENTE del script principal: ejecutar
-- sprint3-bloqueo-asientos.sql no crea ni reprograma este trabajo, y
-- ejecutar este archivo no altera funciones, índices ni permisos.
--
-- Es idempotente: puede ejecutarse varias veces; siempre deja UN SOLO
-- trabajo con el nombre 'liberar-bloqueos-vencidos'.
--
-- SEGURIDAD: la función solo toca reservas 'pendiente_pago' vencidas y
-- sus detalles 'bloqueado'. Jamás modifica reservas 'confirmada',
-- 'usada' ni 'cancelada_*', ni detalles 'reservado' o 'liberado', ni
-- bloqueos todavía vigentes.
--
-- CÓMO EJECUTARLO: corre entero en el SQL Editor aunque pg_cron no
-- esté activo (la sección 1 solo avisa y se omite). Las verificaciones
-- del esquema 'cron' están en la sección 3, comentadas: descoméntalas
-- solo después de habilitar la extensión.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Programación (idempotente)
-- ---------------------------------------------------------------------
do $limpieza$
begin
  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise notice 'pg_cron NO está habilitado. Actívalo en Supabase: Database > Extensions > pg_cron > Enable, y vuelve a ejecutar este archivo.';
    return;
  end if;

  -- Quita el trabajo previo con ese nombre (si existe) para no duplicarlo.
  perform cron.unschedule(j.jobid)
    from cron.job j
   where j.jobname = 'liberar-bloqueos-vencidos';

  -- Lo (re)programa: cada 5 minutos.
  perform cron.schedule(
    'liberar-bloqueos-vencidos',   -- nombre del trabajo
    '*/10 * * * *', -- minuto 0, 10, 20, 30, 40, 50,
    $$select public.liberar_bloqueos_vencidos()$$
  );
end
$limpieza$;

-- ---------------------------------------------------------------------
-- 2) Verificaciones inmediatas (SEGURAS aunque pg_cron no esté habilitado)
-- ---------------------------------------------------------------------

-- (a) ¿pg_cron quedó habilitado? true = listo para la sección 3.
select exists (select 1 from pg_extension where extname = 'pg_cron') as pg_cron_habilitado;

-- (b) Reservas 'pendiente_pago' cuya expiración ya venció: lo que limpiará
--     el próximo job. (La disponibilidad de asientos ya las ignora por
--     fecha; esto es higiene de datos para los reportes.)
select r.id_reserva, r.id_funcion, r.fecha_expiracion,
       ( select count(*)
           from detalle_reserva d
          where d.id_reserva = r.id_reserva
            and d.estado = 'bloqueado' ) as detalles_bloqueados
  from reserva r
 where r.estado = 'pendiente_pago'
   and r.fecha_expiracion <= now()
 order by r.fecha_expiracion;

-- ---------------------------------------------------------------------
-- 3) Verificaciones POSTERIORES a la activación de pg_cron
--    Descoméntalas solo después de habilitar la extensión: sin pg_cron
--    el esquema 'cron' no existe y estas consultas fallarían.
-- ---------------------------------------------------------------------

-- (c) Trabajo programado: debe aparecer UN solo registro.
-- select jobid, jobname, schedule, command, active
--   from cron.job
--  where jobname = 'liberar-bloqueos-vencidos';

-- (d) Últimas ejecuciones reales del trabajo (historial de pg_cron):
--     status 'ok' y return_message con el conteo liberado.
-- select runid, jobid, status, return_message, start_time, end_time
--   from cron.job_run_details
--  where jobid = ( select jobid from cron.job where jobname = 'liberar-bloqueos-vencidos' )
--  order by start_time desc
--  limit 5;

-- ---------------------------------------------------------------------
-- 4) Operación manual opcional
-- ---------------------------------------------------------------------
-- Limpiar sin esperar al job (devuelve cuántas reservas liberó):
-- select public.liberar_bloqueos_vencidos();

-- Desprogramar el trabajo: se busca el jobid por nombre y se pasa a
-- cron.unschedule(bigint), la firma compatible con todas las versiones.
-- select cron.unschedule(j.jobid)
--   from cron.job j
--  where j.jobname = 'liberar-bloqueos-vencidos';
