/**
 * Tipos y lógica pura del flujo de compra (SCRUM-117 / SCRUM-122).
 *
 * Sin acceso a datos: lo usan el servidor (`lib/db/compra.ts`) y el navegador (/entradas,
 * /asientos). Los cálculos de dinero que valen para cobrar se hacen SOLO en el servidor con
 * `calcularResumenCompra`; aquí solo hay límites, formatos y lectura de la URL.
 */
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { TIPOS_ENTRADA, type TipoEntradaId } from "@/lib/entradas";
import { parseFecha } from "@/lib/fechas";

/** Máximo de entradas (de todos los tipos) en una compra. */
export const MAX_ENTRADAS_POR_COMPRA = 10;

/** Recargo sobre el subtotal, en porcentaje. */
export const PORCENTAJE_RECARGO = 5;

/** Cantidad elegida por tipo de entrada. */
export type Cantidades = Record<TipoEntradaId, number>;

export const CANTIDADES_VACIAS: Cantidades = { adulto: 0, tercera: 0, ninos: 0 };

/** La función que se está comprando, ya validada en el servidor. */
export type FuncionCompra = {
  id: number;
  pelicula: string;
  slug: string;
  fecha: string; // YYYY-MM-DD
  hora: string; // HH:MM
  sala: string;
  tipoSala: string;
  formato: string; // "Subtitulada Inglés" / "Doblada Español"
};

export type LineaResumen = {
  tipo: TipoEntradaId;
  nombre: string;
  cantidad: number;
  precioUnitario: number; // quetzales
  importe: number; // precioUnitario × cantidad
};

export type ResumenCompra = {
  funcion: FuncionCompra;
  lineas: LineaResumen[]; // una por tipo de entrada, en el orden de TIPOS_ENTRADA
  entradas: number; // total de entradas
  subtotal: number;
  recargo: number; // PORCENTAJE_RECARGO % del subtotal, redondeado a 2 decimales
  total: number;
};

/** 70 -> "Q 70.00" */
export const quetzales = (monto: number) => `Q ${monto.toFixed(2)}`;

export const formatoFuncion = (idioma: string | null, subtitulos: boolean | null) =>
  idioma ? `${subtitulos ? "Subtitulada" : "Doblada"} ${idioma}` : "";

const mayus = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** "2026-10-18" -> "Sáb 18 oct" (mismo formato que las fechas del detalle de película). */
export const fechaCortaFuncion = (fecha: string) =>
  mayus(format(parseFecha(fecha), "EEE dd MMM", { locale: es }));

/** "Sala 3 VIP 3D" */
export const salaFuncion = (f: FuncionCompra) => [f.sala, f.tipoSala].filter(Boolean).join(" ");

/** Subtítulo del encabezado: "Sala 3 VIP 3D - Sáb 18 oct - Horario: 18:00 - Subtitulada Inglés". */
export const etiquetaFuncion = (f: FuncionCompra) =>
  [salaFuncion(f), fechaCortaFuncion(f.fecha), `Horario: ${f.hora}`, f.formato]
    .filter(Boolean)
    .join(" - ");

/**
 * Valida las cantidades: enteros de 0 a MAX por tipo y un total de 1 a MAX.
 * Devuelve el mensaje de error, o null si son válidas.
 */
export function validarCantidades(c: Cantidades): string | null {
  const valores = TIPOS_ENTRADA.map((t) => c[t.id]);
  if (valores.some((v) => !Number.isInteger(v) || v < 0 || v > MAX_ENTRADAS_POR_COMPRA)) {
    return "Las cantidades de entradas no son válidas.";
  }
  const total = valores.reduce((a, b) => a + b, 0);
  if (total < 1) return "Debes elegir al menos 1 entrada.";
  if (total > MAX_ENTRADAS_POR_COMPRA) {
    return `No puedes comprar más de ${MAX_ENTRADAS_POR_COMPRA} entradas por compra.`;
  }
  return null;
}

/** Lee `adulto`, `tercera` y `ninos` de la URL tal cual (lo que no es número queda en NaN). */
export function cantidadesDeParams(sp: Record<string, string | string[] | undefined>): Cantidades {
  const leer = (k: TipoEntradaId) => {
    const v = sp[k];
    return typeof v === "string" && v.trim() !== "" ? Number(v) : 0;
  };
  return { adulto: leer("adulto"), tercera: leer("tercera"), ninos: leer("ninos") };
}
