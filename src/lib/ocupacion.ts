/**
 * SCRUM-143: reporte de ocupación por función. TypeScript puro (sin `server-only`): lo usan la
 * consulta del servidor, la pantalla y el archivo Excel, de modo que ambos muestran los mismos
 * valores. Las definiciones (capacidad, ocupado, libre, porcentaje) están en
 * supabase/sprint4-reporte-ocupacion.sql.
 */
import { fechaReal } from "@/lib/reportes";
import { parseFecha, toFecha } from "@/lib/fechas";

export const DURACION_PROYECCION_DEFECTO_MIN = 120;

export type FiltrosOcupacion = {
  desde: string | null; // YYYY-MM-DD, fecha de la función
  hasta: string | null;
  idPelicula: number | null;
  idSala: number | null;
  idFuncion: number | null; // la función elegida para ver su ocupación
};

export type FuncionOpcion = {
  id: number;
  idPelicula: number | null;
  pelicula: string;
  idSala: number | null;
  sala: string;
  fecha: string; // YYYY-MM-DD
  hora: string; // HH:MM
  activa: boolean;
  duracionMinutos: number;
};

export type EstadoFuncionOpcion = "Activa" | "Cancelada" | "Finalizada";

export function estadoFuncionOpcion(
  funcion: FuncionOpcion,
  fechaActual: string,
  horaActual: string,
): EstadoFuncionOpcion {
  if (!funcion.activa) return "Cancelada";

  const [anio = NaN, mes = NaN, dia = NaN] = funcion.fecha
    .split("-")
    .map(Number);
  const [hora = NaN, minuto = NaN] = funcion.hora.split(":").map(Number);
  const [anioActual = NaN, mesActual = NaN, diaActual = NaN] =
    fechaActual.split("-").map(Number);
  const [horaAhora = NaN, minutoAhora = NaN] =
    horaActual.split(":").map(Number);
  const valores = [
    anio,
    mes,
    dia,
    hora,
    minuto,
    anioActual,
    mesActual,
    diaActual,
    horaAhora,
    minutoAhora,
  ];
  if (valores.some((valor) => !Number.isFinite(valor))) return "Activa";

  const inicio = Date.UTC(anio, mes - 1, dia, hora, minuto);
  const ahora = Date.UTC(
    anioActual,
    mesActual - 1,
    diaActual,
    horaAhora,
    minutoAhora,
  );
  const fin = inicio + funcion.duracionMinutos * 60_000;

  return ahora >= fin ? "Finalizada" : "Activa";
}

export type AsientoOcupacion = {
  fila: string;
  /** Número que identifica la butaca al cliente, correlativo sin contar pasillos. */
  numero: number;
  /** Columna física de la cuadrícula; mantiene la posición de pasillos y espacios. */
  columna: number;
  tipo: "normal" | "pasillo" | "deshabilitado" | "retirado";
  estado: "ocupado" | "libre" | "no_aplica";
  /** Solo si está ocupado: pagado ("reservado") o en una compra en curso ("en_compra"). */
  origen: "reservado" | "en_compra" | null;
};

export type ReporteOcupacion = {
  funcion: {
    id: number;
    idPelicula: number | null;
    pelicula: string;
    fecha: string;
    hora: string;
    idSala: number | null;
    sala: string;
    activa: boolean;
  };
  resumen: {
    capacidad: number;
    ocupados: number;
    reservados: number;
    enCompra: number;
    disponibles: number;
    porcentaje: number;
  };
  asientos: AsientoOcupacion[];
};

/** Rango por defecto cuando no se pide otro: la semana pasada y las próximas dos semanas. */
export const DIAS_ATRAS = 7;
export const DIAS_ADELANTE = 14;

function sumarDias(fecha: string, dias: number): string {
  const d = parseFecha(fecha);
  d.setDate(d.getDate() + dias);
  return toFecha(d);
}

type Entrada = Record<string, string | string[] | undefined>;

function uno(v: string | string[] | undefined): string | undefined {
  const x = Array.isArray(v) ? v[0] : v;
  return x === undefined ? undefined : x.trim();
}

const ENTERO = /^\d{1,15}$/;

/**
 * Lee y VALIDA los filtros de la URL. Si «desde»/«hasta» no vienen en la URL se usa el rango por
 * defecto; si vienen vacíos (el usuario los borró) significa «sin límite».
 */
export function parseFiltrosOcupacion(
  entrada: Entrada,
  hoy: string,
): { ok: true; filtros: FiltrosOcupacion } | { ok: false; error: string; filtros: FiltrosOcupacion } {
  const rawDesde = uno(entrada["desde"]);
  const rawHasta = uno(entrada["hasta"]);
  const pelicula = uno(entrada["pelicula"]) ?? "";
  const sala = uno(entrada["sala"]) ?? "";
  const funcion = uno(entrada["funcion"]) ?? "";

  const desde = rawDesde === undefined ? sumarDias(hoy, -DIAS_ATRAS) : rawDesde;
  const hasta = rawHasta === undefined ? sumarDias(hoy, DIAS_ADELANTE) : rawHasta;

  const filtros: FiltrosOcupacion = {
    desde: desde && fechaReal(desde) ? desde : null,
    hasta: hasta && fechaReal(hasta) ? hasta : null,
    idPelicula: ENTERO.test(pelicula) && Number(pelicula) > 0 ? Number(pelicula) : null,
    idSala: ENTERO.test(sala) && Number(sala) > 0 ? Number(sala) : null,
    idFuncion: ENTERO.test(funcion) && Number(funcion) > 0 ? Number(funcion) : null,
  };
  const falla = (error: string) => ({ ok: false as const, error, filtros });

  if (desde && !fechaReal(desde)) return falla("La fecha «desde» no es válida.");
  if (hasta && !fechaReal(hasta)) return falla("La fecha «hasta» no es válida.");
  if (filtros.desde && filtros.hasta && filtros.desde > filtros.hasta) {
    return falla("La fecha «desde» no puede ser posterior a la fecha «hasta».");
  }
  if (pelicula && filtros.idPelicula === null) return falla("La película elegida no es válida.");
  if (sala && filtros.idSala === null) return falla("La sala elegida no es válida.");
  if (funcion && filtros.idFuncion === null) return falla("La función elegida no es válida.");
  return { ok: true, filtros };
}

/** Filtros como parámetros de URL; `vacios` conserva «sin límite» cuando una fecha es null. */
export function filtrosOcupacionAParams(f: FiltrosOcupacion, conFuncion = true): URLSearchParams {
  const p = new URLSearchParams();
  p.set("desde", f.desde ?? "");
  p.set("hasta", f.hasta ?? "");
  if (f.idPelicula !== null) p.set("pelicula", String(f.idPelicula));
  if (f.idSala !== null) p.set("sala", String(f.idSala));
  if (conFuncion && f.idFuncion !== null) p.set("funcion", String(f.idFuncion));
  return p;
}

export const etiquetaAsiento = (a: Pick<AsientoOcupacion, "fila" | "numero">) => `${a.fila}${a.numero}`;

export const ETIQUETA_ESTADO: Record<AsientoOcupacion["estado"], string> = {
  ocupado: "Ocupado",
  libre: "Libre",
  no_aplica: "No disponible",
};

export const ETIQUETA_TIPO_ASIENTO: Record<AsientoOcupacion["tipo"], string> = {
  normal: "Asiento",
  pasillo: "Pasillo",
  deshabilitado: "Deshabilitado",
  retirado: "Retirado del plano",
};

export const ETIQUETA_ORIGEN: Record<"reservado" | "en_compra", string> = {
  reservado: "Reservado (pagado)",
  en_compra: "En compra (bloqueo temporal)",
};

/** "41.67 %" / "0 %" (hasta 2 decimales, sin ceros de sobra). */
export function formatoPorcentaje(valor: number): string {
  return `${valor.toLocaleString("es-GT", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} %`;
}

/** Asientos agrupados por fila, en orden. */
export function agruparPorFila(asientos: AsientoOcupacion[]): { fila: string; asientos: AsientoOcupacion[] }[] {
  const mapa = new Map<string, AsientoOcupacion[]>();
  for (const a of asientos) {
    const lista = mapa.get(a.fila) ?? [];
    lista.push(a);
    mapa.set(a.fila, lista);
  }
  return Array.from(mapa, ([fila, lista]) => ({ fila, asientos: lista }));
}

/**
 * ¿Los indicadores generales coinciden con el detalle de asientos? Capacidad = filas del detalle
 * = ocupados + disponibles, y lo ocupado del detalle = ocupados (reservados + en compra). Se
 * comprueba antes de mostrar o exportar: si no coincide, no se entregan cifras dudosas.
 */
export function esCoherente(r: ReporteOcupacion): boolean {
  const { capacidad, ocupados, reservados, enCompra, disponibles } = r.resumen;
  const enDetalle = r.asientos.filter((a) => a.estado === "ocupado").length;
  const reservadosDetalle = r.asientos.filter((a) => a.origen === "reservado").length;
  const asientosVendibles = r.asientos.filter(
    (a) => a.tipo === "normal" || a.estado === "ocupado",
  ).length;
  return (
    capacidad === asientosVendibles &&
    capacidad === ocupados + disponibles &&
    ocupados === enDetalle &&
    ocupados === reservados + enCompra &&
    reservados === reservadosDetalle
  );
}

/** Texto de una función para listas: "23/10/2026 · 19:30 · Batman · Sala 1". */
export function etiquetaFuncionOpcion(f: FuncionOpcion): string {
  const [y, m, d] = f.fecha.split("-");
  return `${d}/${m}/${y} · ${f.hora} · ${f.pelicula} · ${f.sala}${f.activa ? "" : " (cancelada)"}`;
}
