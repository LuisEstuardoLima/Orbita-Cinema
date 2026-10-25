/**
 * SCRUM-140: tipos y mensajes de la validación de entradas. TypeScript puro (sin `server-only`)
 * para usarse tanto en la Server Action como en la pantalla.
 */

export type ModoBusqueda = "qr" | "entrada" | "reserva";

export type MotivoRechazo =
  | "no_encontrada"
  | "otra_funcion"
  | "cancelada"
  | "ya_utilizada"
  | "no_pagada"
  | "funcion_finalizada";

/** Datos de la compra que se muestran al validar (también cuando se rechaza). */
export type DatosEntrada = {
  /** ID de compra (RF-060): es el número de la reserva. */
  idCompra: number;
  idEntrada: number | null;
  comprador: string;
  total: number;
  estado: string;
  idFuncion: number;
  pelicula: string | null;
  sala: string | null;
  fechaFuncion: string | null;
  horaFuncion: string | null;
  fechaUso: string | null;
  asientos: string[];
};

export type ResultadoValidacion =
  | { ok: true; datos: DatosEntrada }
  | { ok: false; motivo: MotivoRechazo | "permiso" | "datos" | "error"; mensaje: string; datos?: DatosEntrada };

export const MENSAJES_RECHAZO: Record<MotivoRechazo, string> = {
  no_encontrada: "No se encontró una entrada válida para ese dato.",
  otra_funcion: "La reserva pertenece a otra función. El ingreso se rechazó.",
  cancelada: "La reserva está cancelada o su función fue cancelada: no es válida para acceder a la función.",
  ya_utilizada: "La reserva ya fue validada anteriormente.",
  no_pagada: "La reserva no está pagada, por lo que no es válida para ingresar.",
  funcion_finalizada: "La función ya terminó: la entrada no se puede validar.",
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * El QR del boleto codifica solo el `codigo_qr` (un uuid). Aquí se normaliza lo que llegue del
 * lector (con espacios, mayúsculas o saltos de línea) y se devuelve null si no es un uuid.
 */
export function normalizarCodigoQr(texto: string): string | null {
  const t = texto.trim();
  return UUID.test(t) ? t.toLowerCase() : null;
}

/**
 * Entero positivo a partir de lo que escribió el usuario, o null. Acepta "123", " 123 ", "#123" y
 * el número de reserva que ve el cliente en su correo y confirmación ("ORB-000123").
 */
export function normalizarNumero(texto: string): number | null {
  const t = texto.trim().replace(/^#/, "").replace(/^orb-/i, "");
  if (!/^\d{1,15}$/.test(t)) return null;
  const n = Number(t);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}
