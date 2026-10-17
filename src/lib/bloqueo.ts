/**
 * Bloqueo temporal de asientos (SCRUM-119): tipos y lógica pura, sin acceso a datos.
 * Lo usan el servidor (`lib/db/bloqueo.ts`, Server Actions) y el navegador (/asientos, /pago).
 */
import type { TipoEntradaId } from "@/lib/entradas";

/** Minutos que dura el bloqueo. Es el valor por defecto de `reserva.fecha_expiracion` en la BD. */
export const MINUTOS_BLOQUEO = 5;

/** Tipo de entrada de la app -> valor que acepta `detalle_reserva.tipo_entrada` (CHECK de la BD). */
export const TIPO_ENTRADA_BD: Record<TipoEntradaId, "adulto" | "tercera_edad" | "nino"> = {
  adulto: "adulto",
  tercera: "tercera_edad",
  ninos: "nino",
};

/** Bloqueo vigente de un cliente, tal como lo devuelve la BD (`bloqueo_vigente`). */
export type BloqueoVigente = {
  idReserva: number;
  idFuncion: number;
  total: number;
  segundosRestantes: number;
  asientos: { id: number; fila: string; numero: number }[];
};

/** "A1", "B10"... */
export const etiquetaAsiento = (fila: string, numero: number) => `${fila}${numero}`;

/** Parte "B10" en { fila: "B", numero: 10 }, o null si no tiene ese formato. */
export function parseAsiento(etiqueta: string): { fila: string; numero: number } | null {
  const m = /^([A-Za-z]+)(\d+)$/.exec(etiqueta.trim());
  if (!m) return null;
  return { fila: m[1]!.toUpperCase(), numero: Number(m[2]) };
}

/** Orden natural: por fila y luego por número (F2 antes que F10). */
export function compararAsientos(a: { fila: string; numero: number }, b: { fila: string; numero: number }) {
  const porFila = a.fila.localeCompare(b.fila);
  return porFila !== 0 ? porFila : a.numero - b.numero;
}

/** 272 -> "04:32" */
export function formatoContador(segundos: number): string {
  const s = Math.max(0, Math.floor(segundos));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
