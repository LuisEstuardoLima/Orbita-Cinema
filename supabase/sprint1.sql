-- =====================================================================
-- Órbita Cinema · Sprint 1 · ejecutar en Supabase > SQL Editor
-- Es idempotente: se puede correr más de una vez sin duplicar nada.
-- =====================================================================

-- 1) Columnas que usa la interfaz y que no están en pelicula --------------
alter table pelicula
  add column if not exists slug            text,
  add column if not exists genero          text,
  add column if not exists director        text,
  add column if not exists actores         text,
  add column if not exists estudio         text;

-- slug a partir del título (ej. "Spider-Man: Un nuevo universo" -> spider-man-un-nuevo-universo)
update pelicula
set slug = trim(both '-' from lower(regexp_replace(
      translate(titulo, 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN'), '[^a-zA-Z0-9]+', '-', 'g')))
where slug is null;

alter table pelicula alter column slug set not null;
create unique index if not exists pelicula_slug_key on pelicula (slug);

-- 2) Clasificaciones del cliente: A, B, B12, B15, C (la cartelera filtra con estas)
--    PG-13 -> B12 y PG -> A es una equivalencia propuesta: ajústenla si prefieren otra.
update pelicula set clasificacion = 'B12' where clasificacion = 'PG-13';
update pelicula set clasificacion = 'A'   where clasificacion = 'PG';

-- 3) Género, director, actor y estudio de las 6 películas de prueba -------
update pelicula p
set genero = v.genero, director = v.director, actores = v.actor, estudio = v.estudio
from (values
  ('El Señor de los Anillos: La Comunidad del Anillo', 'Fantasía',        'Peter Jackson',                                     'Elijah Wood',        'New Line Cinema'),
  ('Interestelar',                                     'Ciencia ficción', 'Christopher Nolan',                                 'Matthew McConaughey','Warner Bros.'),
  ('Spider-Man: Un nuevo universo',                    'Super-héroes',    'Bob Persichetti, Peter Ramsey y Rodney Rothman',    'Shameik Moore',      'Sony Pictures Animation'),
  ('Batman: El caballero de la noche',                 'Super-héroes',    'Christopher Nolan',                                 'Christian Bale',     'Warner Bros.'),
  ('El Viaje de Chihiro',                              'Animación',       'Hayao Miyazaki',                                    'Rumi Hiiragi',       'Studio Ghibli'),
  ('Dune: Parte Dos',                                  'Ciencia ficción', 'Denis Villeneuve',                                  'Timothée Chalamet',  'Legendary Pictures')
) as v(titulo, genero, director, actor, estudio)
where p.titulo = v.titulo;

-- 4) RLS: lectura pública SOLO de registros activos ----------------------
--    Sin estas políticas, la llave pública devuelve listas vacías.
--    Las escrituras del panel admin van por el servidor con la service role (que ignora RLS).
alter table pelicula enable row level security;
alter table sala     enable row level security;
alter table funcion  enable row level security;

drop policy if exists "lectura publica pelicula" on pelicula;
create policy "lectura publica pelicula" on pelicula for select to anon, authenticated using (activa = true);

drop policy if exists "lectura publica sala" on sala;
create policy "lectura publica sala" on sala for select to anon, authenticated using (activa = true);

drop policy if exists "lectura publica funcion" on funcion;
create policy "lectura publica funcion" on funcion for select to anon, authenticated using (activa = true);

-- 5) Bucket público para los pósters que sube el administrador ----------
insert into storage.buckets (id, name, public)
values ('posters', 'posters', true)
on conflict (id) do nothing;
