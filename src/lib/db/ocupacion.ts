import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  DURACION_PROYECCION_DEFECTO_MIN,
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
export const FUNCIONES_POR_PAGINA = 25;

type FilaFuncion = {
  id: number;
  id_pelicula: number | null;
  id_sala: number | null;
  fecha: string;
  hora: string;
  activa: boolean | null;
  duracion_min?: number | null;
};

function mapFuncionOpcion(
  fila: FilaFuncion,
  peliculas: Map<number, { titulo: string; duracionMinutos: number }>,
  salas: Map<number, string>,
): FuncionOpcion {
  const pelicula =
    fila.id_pelicula === null ? undefined : peliculas.get(fila.id_pelicula);
  return {
    id: fila.id,
    idPelicula: fila.id_pelicula,
    pelicula: pelicula?.titulo || "—",
    idSala:
      fila.id_sala,
    sala:
      (fila.id_sala != null && salas.get(fila.id_sala)) ||
      "—",
    fecha: fila.fecha,
    hora: String(fila.hora).slice(0, 5),
    activa: fila.activa ?? false,
    duracionMinutos:
      pelicula?.duracionMinutos ?? DURACION_PROYECCION_DEFECTO_MIN,
  };
}

async function obtenerEtiquetasFuncion(
  filas: FilaFuncion[],
): Promise<{
  peliculas: Map<number, { titulo: string; duracionMinutos: number }>;
  salas: Map<number, string>;
}> {
  const admin = createAdminClient();
  const idsPeliculas = Array.from(
    new Set(
      filas.flatMap((f) =>
        f.id_pelicula === null ? [] : [f.id_pelicula],
      ),
    ),
  );
  const idsSalas = Array.from(
    new Set(
      filas.flatMap((f) =>
        f.id_sala === null ? [] : [f.id_sala],
      ),
    ),
  );

  const [pel, sal] = await Promise.all([
    idsPeliculas.length
      ? admin
          .from("pelicula")
          .select("id, titulo, duracion_min")
          .in("id", idsPeliculas)
      : Promise.resolve({ data: [], error: null }),
    idsSalas.length
      ? admin.from("sala").select("id, nombre").in("id", idsSalas)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (pel.error) throw new Error(`pelicula: ${pel.error.message}`);
  if (sal.error) throw new Error(`sala: ${sal.error.message}`);

  return {
    peliculas: new Map(
      (
        pel.data as {
          id: number;
          titulo: string;
          duracion_min: number | null;
        }[]
      ).map((p) => [
        p.id,
        {
          titulo: p.titulo,
          duracionMinutos:
            p.duracion_min ?? DURACION_PROYECCION_DEFECTO_MIN,
        },
      ]),
    ),
    salas: new Map(
      (sal.data as { id: number; nombre: string }[]).map((s) => [
        s.id,
        s.nombre,
      ]),
    ),
  };
}

/** Funciones por fecha con paginación para la consulta de asistentes. */
export async function listFuncionesOcupacionPaginadas({
  desde,
  hasta,
  idPelicula,
  pagina,
}: {
  desde: string | null;
  hasta: string | null;
  idPelicula: number | null;
  pagina: number;
}): Promise<{
  funciones: FuncionOpcion[];
  total: number;
  pagina: number;
  totalPaginas: number;
}> {
  const admin = createAdminClient();
  const paginaSolicitada = Math.min(
    Math.max(Math.floor(pagina), 1),
    1_000_000,
  );
  const desdeFila =
    (paginaSolicitada - 1) * FUNCIONES_POR_PAGINA;
  let consulta = admin
    .from("funcion")
    .select("id, id_pelicula, id_sala, fecha, hora, activa", {
      count: "exact",
    })
    .order("fecha", { ascending: false })
    .order("hora", { ascending: false })
    .order("id", { ascending: false })
    .range(desdeFila, desdeFila + FUNCIONES_POR_PAGINA - 1);
  if (desde) consulta = consulta.gte("fecha", desde);
  if (hasta) consulta = consulta.lte("fecha", hasta);
  if (idPelicula !== null) {
    consulta = consulta.eq("id_pelicula", idPelicula);
  }

  const resultado = await consulta;
  if (resultado.error) {
    throw new Error(`funcion: ${resultado.error.message}`);
  }

  const total = resultado.count ?? 0;
  const totalPaginas = Math.max(
    Math.ceil(total / FUNCIONES_POR_PAGINA),
    1,
  );
  const paginaActual = Math.min(
    paginaSolicitada,
    totalPaginas,
  );

  if (paginaActual !== paginaSolicitada) {
    return listFuncionesOcupacionPaginadas({
      desde,
      hasta,
      idPelicula,
      pagina: paginaActual,
    });
  }

  const filas = (resultado.data as FilaFuncion[] | null) ?? [];
  const { peliculas, salas } = await obtenerEtiquetasFuncion(filas);

  return {
    total,
    pagina: paginaActual,
    totalPaginas,
    funciones: filas.map((fila) =>
      mapFuncionOpcion(fila, peliculas, salas),
    ),
  };
}

export async function obtenerFuncionOcupacionOpcion(
  idFuncion: number,
): Promise<FuncionOpcion | null> {
  const { data, error } = await createAdminClient()
    .from("funcion")
    .select("id, id_pelicula, id_sala, fecha, hora, activa")
    .eq("id", idFuncion)
    .maybeSingle();
  if (error) throw new Error(`funcion: ${error.message}`);
  if (!data) return null;

  const fila = data as FilaFuncion;
  const { peliculas, salas } = await obtenerEtiquetasFuncion([fila]);
  return mapFuncionOpcion(fila, peliculas, salas);
}

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

  const fun = await consulta;
  if (fun.error) throw new Error(`funcion: ${fun.error.message}`);
  const filas = fun.data as FilaFuncion[];
  const filasPagina = filas.slice(0, LIMITE_FUNCIONES);
  const { peliculas, salas } = await obtenerEtiquetasFuncion(filasPagina);
  const truncado = filas.length > LIMITE_FUNCIONES;
  return {
    truncado,
    funciones: filasPagina.map((fila) =>
      mapFuncionOpcion(fila, peliculas, salas),
    ),
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
