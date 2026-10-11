-- =====================================================================
-- Órbita Cinema · Sprint 2 · SCRUM-111 Gestión de funciones
-- Ejecutar en Supabase > SQL Editor DESPUÉS de sprint1.sql.
-- Es idempotente: se puede correr más de una vez sin duplicar nada.
-- =====================================================================

-- 1) Duración de la película (minutos) -----------------------------------
--    La usa /admin/funciones para detectar cruces de horario en una sala:
--    una función ocupa la sala desde su hora de inicio hasta
--    inicio + duracion_min + 15 min de limpieza.
--    Las películas sin duración conocida quedan en 120 min (default).
alter table pelicula
  add column if not exists duracion_min integer not null default 120;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'pelicula_duracion_min_chk') then
    alter table pelicula
      add constraint pelicula_duracion_min_chk check (duracion_min between 1 and 600);
  end if;
end $$;

-- 2) Duraciones reales de las 6 películas de prueba ----------------------
update pelicula p
set duracion_min = v.minutos
from (values
  ('El Señor de los Anillos: La Comunidad del Anillo', 178),
  ('Interestelar',                                     169),
  ('Spider-Man: Un nuevo universo',                    117),
  ('Batman: El caballero de la noche',                 152),
  ('El Viaje de Chihiro',                              125),
  ('Dune: Parte Dos',                                  166)
) as v(titulo, minutos)
where p.titulo = v.titulo;

-- 3) Índice para la validación de cruces ---------------------------------
--    La validación busca las funciones activas de una sala entre el día
--    anterior y el siguiente (por las que pasan de medianoche).
create index if not exists funcion_sala_fecha_activa_idx
  on funcion (id_sala, fecha) where activa;
