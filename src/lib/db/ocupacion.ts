import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  esCoherente,
  type AsientoOcupacion,
  type FiltrosOcupacion,
  type FuncionOpcion,
  type ReporteOcupacion,
} from "@/lib/ocupacion";

/**
 * SCRUM-143: consultas del reporte de ocupación. Solo LEEN. La ocupación de una función la
 * calcula la función SQL `reporte_ocupacion_funcion` (supabase/sprint4-reporte-ocupacion.sql) a
 * partir de funcion / asiento / reserva / detalle_reserva, sin copiar datos ni crear registros.
 *
 * Quien llame debe haber verificado antes el rol Administrador (la página y el route handler lo hacen).
 */

export const LIMITE_FUNCIONES = 300;

/** Funciones que cumplen los filtros (fecha, película, sala), de la más reciente a la más antigua. */
export async function listFuncionesOcupacion(
  f: FiltrosOcupacion,
): Promise<{ funciones: FuncionOpcion[]; truncado: boolean }> {
  const admin = createAdminClient();
  let consulta = admin
    .from("funcion")
    .select("id, id_pelicula, id_sala, fecha, hora, activa")
    .order("fecha", { ascending: false })
    .order("hora", { ascending: false })
    .limit(LIMITE_FUNCIONES + 1);
  if (f.desde) consulta = consulta.gte("fecha", f.desde);
  if (f.hasta) consulta = consulta.lte("fecha", f.hasta);
  if (f.idPelicula !== null) consulta = consulta.eq("id_pelicula", f.idPelicula);
  if (f.idSala !== null) consulta = consulta.eq("id_sala", f.idSala);

  const [fun, pel, sal] = await Promise.all([
    consulta,
    admin.from("pelicula").select("id, titulo"),
    admin.from("sala").select("id, nombre"),
  ]);
  if (fun.error) throw new Error(`funcion: ${fun.error.message}`);
  if (pel.error) throw new Error(`pelicula: ${pel.error.message}`);
  if (sal.error) throw new Error(`sala: ${sal.error.message}`);

  const titulos = new Map((pel.data as { id: number; titulo: string }[]).map((p) => [p.id, p.titulo]));
  const salas = new Map((sal.data as { id: number; nombre: string }[]).map((s) => [s.id, s.nombre]));

  const filas = fun.data as {
    id: number;
    id_pelicula: number | null;
    id_sala: number | null;
    fecha: string;
    hora: string;
    activa: boolean | null;
  }[];
  const truncado = filas.length > LIMITE_FUNCIONES;
  return {
    truncado,
    funciones: filas.slice(0, LIMITE_FUNCIONES).map((x) => ({
      id: x.id,
      idPelicula: x.id_pelicula,
      pelicula: (x.id_pelicula != null && titulos.get(x.id_pelicula)) || "—",
      idSala: x.id_sala,
      sala: (x.id_sala != null && salas.get(x.id_sala)) || "—",
      fecha: x.fecha,
      hora: String(x.hora).slice(0, 5),
      activa: x.activa ?? false,
    })),
  };
}

/** Salas para el filtro (todas, incluso las inactivas: pueden tener funciones históricas). */
export async function listSalasOcupacion(): Promise<{ id: number; nombre: string }[]> {
  const { data, error } = await createAdminClient().from("sala").select("id, nombre").order("nombre");
  if (error) throw new Error(`sala: ${error.message}`);
  return (data as { id: number; nombre: string }[]) ?? [];
}

type JsonOcupacion = {
  funcion: {
    id: number;
    id_pelicula: number | null;
    pelicula: string | null;
    fecha: string;
    hora: string;
    id_sala: number | null;
    sala: string | null;
    activa: boolean;
  };
  resumen: {
    capacidad: number;
    ocupados: number;
    reservados: number;
    en_compra: number;
    disponibles: number;
    porcentaje: number | string;
  };
  asientos: AsientoOcupacion[];
};

/**
 * Ocupación de una función, o null si la función no existe. Si los indicadores no coincidieran con
 * el detalle de asientos lanza un error: nunca se entregan cifras incoherentes.
 */
export async function consultarOcupacionFuncion(idFuncion: number): Promise<ReporteOcupacion | null> {
  const { data, error } = await createAdminClient().rpc("reporte_ocupacion_funcion", {
    p_funcion: idFuncion,
  });
  if (error) throw new Error(`reporte_ocupacion_funcion: ${error.message}`);
  if (!data) return null;

  const j = data as JsonOcupacion;
  const reporte: ReporteOcupacion = {
    funcion: {
      id: j.funcion.id,
      idPelicula: j.funcion.id_pelicula,
      pelicula: j.funcion.pelicula ?? "—",
      fecha: j.funcion.fecha,
      hora: String(j.funcion.hora).slice(0, 5),
      idSala: j.funcion.id_sala,
      sala: j.funcion.sala ?? "—",
      activa: j.funcion.activa,
    },
    resumen: {
      capacidad: Number(j.resumen.capacidad),
      ocupados: Number(j.resumen.ocupados),
      reservados: Number(j.resumen.reservados),
      enCompra: Number(j.resumen.en_compra),
      disponibles: Number(j.resumen.disponibles),
      porcentaje: Number(j.resumen.porcentaje),
    },
    asientos: j.asientos ?? [],
  };
  if (!esCoherente(reporte)) throw new Error("ocupación incoherente entre indicadores y detalle");
  return reporte;
}
