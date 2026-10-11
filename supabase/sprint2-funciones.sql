-- =====================================================================
-- Órbita Cinema · Sprint 2 · SCRUM-111 Gestión de funciones
-- Ejecutar en Supabase > SQL Editor DESPUÉS de sprint1.sql (y de sprint2-auth.sql
-- si ya se usa; no tocan las mismas tablas, así que el orden entre ellos da igual).
-- Es idempotente: se puede correr más de una vez sin duplicar nada.
-- =====================================================================

-- 1) Duración de la película (minutos) -----------------------------------
--    El equipo ya creó `pelicula.duracion_min` (nullable) y el formulario de
--    películas la captura (SCRUM-108, 1 a 600 min). Aquí solo se asegura que
--    exista con esa misma definición; si ya existe, NO se modifica.
--    /admin/funciones la usa para detectar cruces de horario en una sala:
--    una función ocupa la sala desde su inicio hasta inicio + duracion_min +
--    15 min de limpieza. Si es null, la aplicación asume 120 min.
alter table pelicula
  add column if not exists duracion_min integer;

--    Misma regla que el formulario de películas. `not valid`: solo se exige a
--    las filas nuevas o modificadas, para no fallar si ya hay datos antiguos
--    fuera de rango (revisarlos con: select id, titulo, duracion_min from pelicula
--    where duracion_min not between 1 and 600;).
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'pelicula_duracion_min_chk') then
    alter table pelicula
      add constraint pelicula_duracion_min_chk
      check (duracion_min between 1 and 600) not valid;
  end if;
end $$;

-- 2) Duraciones reales de las 6 películas de prueba ----------------------
--    Solo donde todavía no hay duración: no pisa lo que se haya capturado
--    desde el formulario de películas.
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
where p.titulo = v.titulo
  and p.duracion_min is null;

-- 3) Índice para la validación de cruces ---------------------------------
--    La validación busca las funciones activas de una sala entre el día
--    anterior y el siguiente (por las que pasan de medianoche).
create index if not exists funcion_sala_fecha_activa_idx
  on funcion (id_sala, fecha) where activa;
