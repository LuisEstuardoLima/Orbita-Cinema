/**
 * SCRUM-142: reporte de ventas y reservas. TypeScript puro (sin `server-only`): lo usan la
 * consulta del servidor, la tabla de la pantalla y el archivo Excel. La tabla y el Excel se
 * construyen con LAS MISMAS columnas y valores (`columnasReporte` / `valorCelda`), por eso el
 * archivo siempre coincide con lo que se consultó en pantalla.
 *
 * Definiciones (ver supabase/sprint4-reportes.sql):
 *  · Reserva vigente = confirmada, usada, o compra en curso con bloqueo sin vencer. Las canceladas
 *    y las expiradas no cuentan.
 *  · Venta = reserva vigente confirmada/usada con pago aprobado; el importe recaudado es la suma
 *    de los pagos aprobados.
 */

export type TipoReporte = "ambas" | "ventas" | "reservas";
export type AgruparPor = "funcion" | "pelicula";

export type FiltrosReporte = {
  desde: string | null; // YYYY-MM-DD, fecha de la función
  hasta: string | null;
  tipo: TipoReporte;
  agrupar: AgruparPor;
  idPelicula: number | null;
};

export type Cifras = { cantidad: number; entradas: number; importe: number };

export type FilaReporte = {
  idPelicula: number | null;
  pelicula: string;
  idFuncion: number | null; // solo agrupando por función
  fecha: string | null; // YYYY-MM-DD
  hora: string | null; // HH:MM
  sala: string | null;
  funciones: number; // cuántas funciones suma la fila (1 si es por función)
  reservas: Cifras; // vigentes (incluye las ventas)
  ventas: Cifras; // pagadas
};

export const FILTROS_POR_DEFECTO: FiltrosReporte = {
  desde: null,
  hasta: null,
  tipo: "ambas",
  agrupar: "funcion",
  idPelicula: null,
};

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

export function fechaReal(texto: string): boolean {
  if (!FECHA.test(texto)) return false;
  const [y, m, d] = texto.split("-").map(Number) as [number, number, number];
  const f = new Date(Date.UTC(y, m - 1, d));
  return f.getUTCFullYear() === y && f.getUTCMonth() === m - 1 && f.getUTCDate() === d;
}

type Entrada = Record<string, string | string[] | undefined>;

function uno(v: string | string[] | undefined): string {
  return (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
}

/** Lee y VALIDA los filtros que llegan en la URL (nunca se confía en ellos). */
export function parseFiltros(
  entrada: Entrada,
): { ok: true; filtros: FiltrosReporte } | { ok: false; error: string; filtros: FiltrosReporte } {
  const desde = uno(entrada["desde"]);
  const hasta = uno(entrada["hasta"]);
  const tipo = uno(entrada["tipo"]) || "ambas";
  const agrupar = uno(entrada["agrupar"]) || "funcion";
  const pelicula = uno(entrada["pelicula"]);

  const base: FiltrosReporte = {
    ...FILTROS_POR_DEFECTO,
    desde: desde && fechaReal(desde) ? desde : null,
    hasta: hasta && fechaReal(hasta) ? hasta : null,
    tipo: tipo === "ventas" || tipo === "reservas" ? tipo : "ambas",
    agrupar: agrupar === "pelicula" ? "pelicula" : "funcion",
    idPelicula: /^\d{1,15}$/.test(pelicula) && Number(pelicula) > 0 ? Number(pelicula) : null,
  };

  const falla = (error: string) => ({ ok: false as const, error, filtros: base });
  if (desde && !fechaReal(desde)) return falla("La fecha «desde» no es válida.");
  if (hasta && !fechaReal(hasta)) return falla("La fecha «hasta» no es válida.");
  if (base.desde && base.hasta && base.desde > base.hasta) {
    return falla("La fecha «desde» no puede ser posterior a la fecha «hasta».");
  }
  if (!["ambas", "ventas", "reservas"].includes(tipo)) return falla("El tipo de reporte no es válido.");
  if (!["funcion", "pelicula"].includes(agrupar)) return falla("La agrupación no es válida.");
  if (pelicula && base.idPelicula === null) return falla("La película elegida no es válida.");
  return { ok: true, filtros: base };
}

/** Los filtros como parámetros de URL (para el enlace de descarga: mismos filtros que en pantalla). */
export function filtrosAParams(f: FiltrosReporte): URLSearchParams {
  const p = new URLSearchParams();
  if (f.desde) p.set("desde", f.desde);
  if (f.hasta) p.set("hasta", f.hasta);
  p.set("tipo", f.tipo);
  p.set("agrupar", f.agrupar);
  if (f.idPelicula !== null) p.set("pelicula", String(f.idPelicula));
  return p;
}

export type ColumnaReporte = {
  clave: string;
  titulo: string;
  tipo: "texto" | "entero" | "moneda";
  /** Encabezado de grupo cuando se ven ventas y reservas juntas. */
  grupo?: "Reservas vigentes" | "Ventas";
};

/** Columnas según la agrupación y el tipo elegido. */
export function columnasReporte(f: Pick<FiltrosReporte, "tipo" | "agrupar">): ColumnaReporte[] {
  const base: ColumnaReporte[] =
    f.agrupar === "funcion"
      ? [
          { clave: "pelicula", titulo: "Película", tipo: "texto" },
          { clave: "funcion", titulo: "Función", tipo: "texto" },
          { clave: "fecha", titulo: "Fecha", tipo: "texto" },
          { clave: "sala", titulo: "Sala", tipo: "texto" },
        ]
      : [
          { clave: "pelicula", titulo: "Película", tipo: "texto" },
          { clave: "funciones", titulo: "Funciones", tipo: "entero" },
        ];
  const conGrupo = f.tipo === "ambas";
  const reservas: ColumnaReporte[] = [
    { clave: "r_cant", titulo: "Reservas vigentes", tipo: "entero", ...(conGrupo ? { grupo: "Reservas vigentes" as const } : {}) },
    { clave: "r_entr", titulo: "Entradas reservadas", tipo: "entero", ...(conGrupo ? { grupo: "Reservas vigentes" as const } : {}) },
    { clave: "r_imp", titulo: "Importe reservado", tipo: "moneda", ...(conGrupo ? { grupo: "Reservas vigentes" as const } : {}) },
  ];
  const ventas: ColumnaReporte[] = [
    { clave: "v_cant", titulo: "Reservas pagadas", tipo: "entero", ...(conGrupo ? { grupo: "Ventas" as const } : {}) },
    { clave: "v_entr", titulo: "Entradas vendidas", tipo: "entero", ...(conGrupo ? { grupo: "Ventas" as const } : {}) },
    { clave: "v_imp", titulo: "Importe recaudado", tipo: "moneda", ...(conGrupo ? { grupo: "Ventas" as const } : {}) },
  ];
  if (f.tipo === "reservas") return [...base, ...reservas];
  if (f.tipo === "ventas") return [...base, ...ventas];
  return [...base, ...reservas, ...ventas];
}

/** "2026-10-23" -> "23/10/2026". */
export function fechaCorta(fecha: string | null): string {
  if (!fecha) return "—";
  const [y, m, d] = fecha.split("-");
  return y && m && d ? `${d}/${m}/${y}` : fecha;
}

/** Valor de una celda (el mismo para la tabla y para el Excel). */
export function valorCelda(fila: FilaReporte, clave: string): string | number {
  switch (clave) {
    case "pelicula":
      return fila.pelicula;
    case "funcion":
      return fila.idFuncion !== null ? `#${fila.idFuncion} · ${fila.hora ?? ""}`.trim() : "—";
    case "fecha":
      return fechaCorta(fila.fecha);
    case "sala":
      return fila.sala ?? "—";
    case "funciones":
      return fila.funciones;
    case "r_cant":
      return fila.reservas.cantidad;
    case "r_entr":
      return fila.reservas.entradas;
    case "r_imp":
      return fila.reservas.importe;
    case "v_cant":
      return fila.ventas.cantidad;
    case "v_entr":
      return fila.ventas.entradas;
    case "v_imp":
      return fila.ventas.importe;
    default:
      return "";
  }
}

/** Fila de totales (suma de lo consultado). Los importes se suman en centavos: sin arrastre de flotantes. */
export function totalesReporte(filas: FilaReporte[]): FilaReporte {
  const suma = (f: (x: FilaReporte) => number) => filas.reduce((a, x) => a + f(x), 0);
  const centavos = (f: (x: FilaReporte) => number) =>
    filas.reduce((a, x) => a + Math.round(f(x) * 100), 0) / 100;
  return {
    idPelicula: null,
    pelicula: "TOTAL",
    idFuncion: null,
    fecha: null,
    hora: null,
    sala: null,
    funciones: suma((x) => x.funciones),
    reservas: {
      cantidad: suma((x) => x.reservas.cantidad),
      entradas: suma((x) => x.reservas.entradas),
      importe: centavos((x) => x.reservas.importe),
    },
    ventas: {
      cantidad: suma((x) => x.ventas.cantidad),
      entradas: suma((x) => x.ventas.entradas),
      importe: centavos((x) => x.ventas.importe),
    },
  };
}

export const ETIQUETA_TIPO: Record<TipoReporte, string> = {
  ambas: "Ventas y reservas",
  ventas: "Solo ventas",
  reservas: "Solo reservas",
};

export const ETIQUETA_AGRUPAR: Record<AgruparPor, string> = {
  funcion: "Por función",
  pelicula: "Por película",
};
