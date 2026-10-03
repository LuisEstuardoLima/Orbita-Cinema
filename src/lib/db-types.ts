/** Filas tal como están en Supabase (a mano; luego se pueden generar con `bunx supabase gen types`). */
export type PeliculaRow = {
  id: number;
  slug: string;
  titulo: string;
  clasificacion: string;
  genero: string | null;
  sinopsis: string | null;
  poster_url: string | null;
  director: string | null;
  actores: string | null;
  actor_principal: string | null; // columna que agregó sprint1.sql v1; se lee como respaldo de `actores`
  estudio: string | null;
  activa: boolean;
};

export type SalaRow = {
  id: number;
  nombre: string;
  capacidad: number;
  tipo_sala: string | null;
  activa: boolean;
};

export type FuncionRow = {
  id: number;
  id_pelicula: number | null;
  id_sala: number | null;
  fecha: string; // YYYY-MM-DD
  hora: string; // HH:MM:SS
  idioma: string | null;
  subtitulos: boolean | null;
  activa: boolean | null;
};
