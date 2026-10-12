-- =====================================================================
-- Órbita Cinema · Sprint 2 · SCRUM-109/110 Opción A: capacidad de salas
-- Ejecutar en Supabase > SQL Editor DESPUÉS de sprint1.sql.
-- Es idempotente: se puede correr más de una vez sin duplicar nada.
--
-- Opción A:
--  - El formulario de salas ya NO pide capacidad (ni al crear ni al editar).
--  - Una sala nueva nace con capacidad = 0 ("Sin asientos configurados").
--  - Solo `guardarDistribucionAsientos` recalcula `sala.capacidad`
--    (= nº de asientos "normal" del plano).
-- =====================================================================

-- 1) DEFAULT 0 para salas nuevas ---------------------------------------
alter table sala
  alter column capacidad set default 0;

-- 2) Normalizar NULL legacy a 0 ----------------------------------------
--    Filas antiguas creadas antes de este cambio podían quedar en NULL.
--    La UI trata NULL igual que 0, pero normalizar deja un único estado
--    "sin plano" y evita sorpresas en ORDER BY / agregados.
update sala
set capacidad = 0
where capacidad is null;

-- 3) Documentación en el catálogo ---------------------------------------
comment on column sala.capacidad is
  'Opción A: 0 = sin plano de asientos configurado. Solo se recalcula al guardar la distribución del plano (nº de asientos normal).';
