import "server-only";
import { addDays } from "date-fns";
import { createAdminClient } from "@/lib/supabase/admin";
import { ahoraGuatemala, parseFecha, toFecha } from "@/lib/fechas";
import type { FuncionRow, PeliculaRow, SalaRow } from "@/lib/db-types";
import { DURACION_PROYECCION_DEFECTO_MIN } from "@/lib/ocupacion";

/**
 * SCRUM-111: consultas del módulo /admin/funciones.
 *
 * Todo va con la service role (igual que `listPeliculasAdmin`): el panel tiene que ver también
 * las funciones canceladas (`activa = false`), que las políticas RLS ocultan al público.
 */

/** Minutos de limpieza de la sala entre una función y la siguiente. */
export const LIMPIEZA_MIN = 15;

/** Duración que se asume para una película sin `duracion_min` (columna nullable). */
export const DURACION_DEFECTO_MIN = DURACION_PROYECCION_DEFECTO_MIN;

/** Fila del listado admin: la función con el título de su película y el nombre de su sala. */
export type FuncionAdmin = {
  id: number;
  idPelicula: number | null;
  idSala: number | null;
  pelicula: string;
  sala: string;
  fecha: string; // YYYY-MM-DD
  hora: string; // HH:MM
  idioma: string; // tal como está guardado
  subtitulos: boolean;
  activa: boolean;
};

export type OpcionPelicula = { id: number; titulo: string; duracion: number | null };
export type OpcionSala = { id: number; nombre: string; tipo: string };

type EstadoFiltro = "todas" | "activas" | "canceladas" | "finalizadas";

/**
 * Listado del panel de funciones.
 * Si se pasan `fechaDesde` y/o `fechaHasta`, filtra ese rango (incluye fechas pasadas).
 * Si no se pasan fechas, default a hoy en adelante (comportamiento actual).
 * `estado` filtra por activa / cancelada; "finalizadas" se calcula en el cliente.
 */
export async function listFuncionesAdmin(params?: {
  fechaDesde?: string;
  fechaHasta?: string;
  estado?: EstadoFiltro;
}): Promise<{ hoy: string; funciones: FuncionAdmin[] }> {
  const admin = createAdminClient();
  const hoy = ahoraGuatemala().fecha;

  let consulta = admin.from("funcion").select("*").order("fecha").order("hora");

  // Por defecto, desde hoy en adelante; si se pasa fechaDesde, se respeta ese rango.
  if (params?.fechaDesde) {
    consulta = consulta.gte("fecha", params.fechaDesde);
  } else {
    consulta = consulta.gte("fecha", hoy);
  }
  if (params?.fechaHasta) {
    consulta = consulta.lte("fecha", params.fechaHasta);
  }

  const [fun, pel, sal] = await Promise.all([
    consulta,
    admin.from("pelicula").select("id, titulo"),
    admin.from("sala").select("id, nombre"),
  ]);
  if (fun.error) throw new Error(`funcion: ${fun.error.message}`);
  if (pel.error) throw new Error(`pelicula: ${pel.error.message}`);
  if (sal.error) throw new Error(`sala: ${sal.error.message}`);

  const titulos = new Map(
    (pel.data as Pick<PeliculaRow, "id" | "titulo">[]).map((p) => [p.id, p.titulo]),
  );
  const salas = new Map(
    (sal.data as Pick<SalaRow, "id" | "nombre">[]).map((s) => [s.id, s.nombre]),
  );

  let filas = (fun.data as FuncionRow[]).map((f) => ({
    id: f.id,
    idPelicula: f.id_pelicula,
    idSala: f.id_sala,
    pelicula: (f.id_pelicula != null && titulos.get(f.id_pelicula)) || "—",
    sala: (f.id_sala != null && salas.get(f.id_sala)) || "—",
    fecha: f.fecha,
    hora: f.hora.slice(0, 5),
    idioma: f.idioma ?? "",
    subtitulos: f.subtitulos ?? false,
    activa: f.activa ?? false,
  }));

  // Filtro por estado en servidor para activas/canceladas.
  if (params?.estado === "activas") {
    filas = filas.filter((f) => f.activa);
  } else if (params?.estado === "canceladas") {
    filas = filas.filter((f) => !f.activa);
  }

  return {
    hoy,
    funciones: filas,
  };
}

/** Opciones del formulario: solo películas activas (y no eliminadas) y salas activas. */
export async function listOpcionesFuncion(): Promise<{
  peliculas: OpcionPelicula[];
  salas: OpcionSala[];
}> {
  const admin = createAdminClient();
  const [pel, sal] = await Promise.all([
    admin
      .from("pelicula")
      .select("id, titulo, duracion_min")
      .eq("activa", true)
      .eq("eliminada", false)
      .order("titulo"),
    admin.from("sala").select("id, nombre, tipo_sala").eq("activa", true).order("id"),
  ]);
  if (pel.error) throw new Error(`pelicula: ${pel.error.message}`);
  if (sal.error) throw new Error(`sala: ${sal.error.message}`);

  return {
    peliculas: (pel.data as Pick<PeliculaRow, "id" | "titulo" | "duracion_min">[]).map((p) => ({
      id: p.id,
      titulo: p.titulo,
      duracion: p.duracion_min,
    })),
    salas: (sal.data as Pick<SalaRow, "id" | "nombre" | "tipo_sala">[]).map((s) => ({
      id: s.id,
      nombre: s.nombre,
      tipo: s.tipo_sala ?? "",
    })),
  };
}

/**
 * Minutos absolutos (desde 1970-01-01) de una fecha y hora. Comparar en esta escala hace que
 * una función de las 23:00 que termina a la 01:15 del día siguiente se cruce bien con las de
 * ese otro día.
 */
const minutosAbs = (fecha: string, hora: string) => {
  const [y, m, d] = fecha.split("-").map(Number) as [number, number, number];
  const [h, min] = hora.split(":").map(Number) as [number, number];
  return Date.UTC(y, m - 1, d) / 60000 + h * 60 + min;
};

const aHora = (minutos: number) => {
  const delDia = ((minutos % 1440) + 1440) % 1440;
  return `${String(Math.floor(delDia / 60)).padStart(2, "0")}:${String(delDia % 60).padStart(2, "0")}`;
};

export type Cruce = { pelicula: string; fecha: string; inicio: string; fin: string };

/**
 * Busca una función activa de la misma sala que se traslape con la nueva.
 * Cada función ocupa la sala en [inicio, inicio + duración + LIMPIEZA_MIN): si una termina a
 * las 18:00 y otra empieza a las 18:00, no se cruzan. Se revisan también el día anterior y el
 * siguiente por las funciones que pasan de medianoche.
 *
 * ⚠️ Es una validación de aplicación: dos guardados exactamente simultáneos podrían pasarla
 * ambos. Ver "Cruce de horarios" en el README (alternativa B como mejora futura).
 */
export async function buscarCruce(nueva: {
  idSala: number;
  fecha: string;
  hora: string; // HH:MM
  duracionMin: number;
  excluirId?: number;
}): Promise<Cruce | null> {
  const admin = createAdminClient();
  const dia = parseFecha(nueva.fecha);

  let consulta = admin
    .from("funcion")
    .select("*")
    .eq("id_sala", nueva.idSala)
    .eq("activa", true)
    .gte("fecha", toFecha(addDays(dia, -1)))
    .lte("fecha", toFecha(addDays(dia, 1)));
  if (nueva.excluirId) consulta = consulta.neq("id", nueva.excluirId);
  const fun = await consulta;
  if (fun.error) throw new Error(`funcion: ${fun.error.message}`);

  const otras = fun.data as FuncionRow[];
  if (otras.length === 0) return null;

  const ids = [
    ...new Set(otras.map((f) => f.id_pelicula).filter((id): id is number => id != null)),
  ];
  const pel = await admin.from("pelicula").select("id, titulo, duracion_min").in("id", ids);
  if (pel.error) throw new Error(`pelicula: ${pel.error.message}`);
  const peliculas = new Map(
    (pel.data as Pick<PeliculaRow, "id" | "titulo" | "duracion_min">[]).map((p) => [p.id, p]),
  );

  const inicio = minutosAbs(nueva.fecha, nueva.hora);
  const fin = inicio + nueva.duracionMin + LIMPIEZA_MIN;

  for (const f of otras) {
    const p = f.id_pelicula == null ? undefined : peliculas.get(f.id_pelicula);
    const otroInicio = minutosAbs(f.fecha, f.hora.slice(0, 5));
    const otroFin = otroInicio + (p?.duracion_min ?? DURACION_DEFECTO_MIN) + LIMPIEZA_MIN;
    if (inicio < otroFin && otroInicio < fin) {
      return {
        pelicula: p?.titulo ?? "otra película",
        fecha: f.fecha,
        inicio: f.hora.slice(0, 5),
        fin: aHora(otroFin),
      };
    }
  }
  return null;
}
