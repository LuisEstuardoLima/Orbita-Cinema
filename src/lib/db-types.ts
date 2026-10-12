/** Filas tal como están en Supabase (a mano; luego se pueden generar con `bunx supabase gen types`). */
export type PeliculaRow = {
  id: number;
  slug: string;
  titulo: string;
  clasificacion: string;
  genero: string | null;
  sinopsis: string | null;
  poster_url: string | null;
  duracion_min: number | null; // minutos; lo agregó el equipo de funciones/salas
  director: string | null;
  actores: string | null;
  actor_principal: string | null; // columna que agregó sprint1.sql v1; se lee como respaldo de `actores`
  estudio: string | null;
  activa: boolean;
  eliminada: boolean; // true = oculta del panel admin (botón Eliminar); nunca se borra la fila
};

export type SalaRow = {
  id: number;
  nombre: string;
  // Opción A: derivada de la distribución de asientos (SCRUM-110).
  // DEFAULT 0 en BD = sala nueva sin plano; solo `guardarDistribucionAsientos`
  // recalcula este valor. NULL legacy se trata igual que 0 en la UI.
  capacidad: number | null;
  tipo_sala: string | null;
  activa: boolean;
};

/**
 * SCRUM-110: plano FÍSICO de asientos de una sala (qué asientos existen).
 * NO guarda ventas: la disponibilidad por función se calcula en el Sprint 3
 * restando las reservas. estado:
 *   normal       = asiento real que se puede vender
 *   pasillo      = pasillo, nunca es asiento
 *   deshabilitado = posición bloqueada/rota, no se vende
 */
export type AsientoRow = {
  id: number;
  id_sala: number;
  fila: string; // "A", "B", ...
  numero: number; // 1, 2, ...
  estado: "normal" | "pasillo" | "deshabilitado";
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

export type RolRow = {
  id_rol: number; // 1 Cliente, 2 Colaborador, 3 Administrador
  nombre: string;
};

export type UsuarioRow = {
  id_usuario: string; // FK a auth.users.id
  nombre: string;
  apellido: string;
  telefono: string | null;
  id_rol: number; // FK a rol.id_rol: la fuente única del rol
  created_at: string;
};