/**
 * Este archivo es el "traductor" entre la base de datos (en español,
 * igual que el diagrama entidad-relación) y el código de la app (en inglés,
 * igual que el resto de componentes de React).
 *
 * Regla del equipo: ningún componente debe leer directamente los nombres
 * en español (`titulo`, `actores`, etc.). Todo pasa primero por una función
 * de este archivo, y de ahí en adelante solo se usan los nombres en inglés
 * (`title`, `actor`, etc.) que ya usa el resto del proyecto.
 */

import type { Movie } from "./cinema-data";

/** Como llega una fila de la tabla `pelicula` en Supabase, tal cual. */
export type PeliculaRow = {
  id: number;
  titulo: string;
  clasificacion: string;
  genero: string;
  sinopsis: string;
  poster_url: string;
  director: string | null;
  actores: string | null;
  estudio: string | null;
  activa: boolean;
};

/**
 * Traduce UNA fila de `pelicula` (español) al tipo `Movie` que ya usa
 * toda la app (inglés). `slug` y `times` no viven en esta tabla todavía,
 * así que se arman o se completan aparte (ver nota al final del archivo).
 */
export function mapPelicula(row: PeliculaRow): Omit<Movie, "slug" | "times" | "languages"> {
  return {
    id: String(row.id),
    title: row.titulo,
    rating: row.clasificacion,
    genre: row.genero,
    synopsis: row.sinopsis,
    poster: row.poster_url,
    director: row.director ?? "",
    actor: row.actores ?? "",
    studio: row.estudio ?? "",
  };
}

/** Traduce una lista completa de filas (lo normal al hacer un `select`). */
export function mapPeliculas(rows: PeliculaRow[]) {
  return rows.map(mapPelicula);
}

/*
 * NOTA para quien conecte la consulta real (ej. SCRUM-11, cartelera):
 *
 *   const { data } = await supabase.from("pelicula").select("*").eq("activa", true);
 *   const movies = mapPeliculas(data ?? []);
 *
 * `slug` (usado en las URLs /pelicula/batman) y `times`/`languages`
 * (que hoy vienen de HALLS en cinema-data.ts) todavía no tienen columna
 * propia — eso se resuelve cuando conecten la tabla `funcion`, no es
 * parte de este archivo.
 */
