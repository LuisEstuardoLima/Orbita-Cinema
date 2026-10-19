/**
 * Tipos y lógica pura del flujo de compra (SCRUM-117 / SCRUM-122).
 *
 * Sin acceso a datos: lo usan el servidor (`lib/db/compra.ts`) y el navegador (/entradas,
 * /asientos). Los cálculos de dinero que valen para cobrar se hacen SOLO en el servidor con
 * `calcularResumenCompra`; aquí solo hay límites, formatos y lectura de la URL.
 */
import { z } from "zod";
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
  clasificacion: string; // Clasificación de la película (B15, C, etc.)
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

/**
 * Datos del comprador invitado (CA2–CA3 del ticket INVITADO): nombre completo,
 * correo y teléfono. El navegador valida con este schema antes de avanzar al
 * pago y el servidor lo vuelve a validar al confirmar la compra (SCRUM-125):
 * nunca se confía solo en la validación del cliente.
 */
export const datosInvitadoSchema = z.object({
  nombre: z.string().trim().min(1, "Escribe tu nombre completo."),
  correo: z
    .string()
    .trim()
    .min(1, "Escribe tu correo electrónico.")
    .email("El correo no tiene un formato válido."),
  telefono: z
    .string()
    .trim()
    .min(8, "Escribe un teléfono válido (mínimo 8 dígitos).")
    .regex(/^[0-9\s\-+()]+$/, "El teléfono solo puede contener dígitos, espacios, guiones y paréntesis."),
});

export type DatosInvitado = z.infer<typeof datosInvitadoSchema>;

/**
 * Lógica de la tarjeta de crédito/débito (ticket COMPRA - Pago con tarjeta).
 * Es lógica pura: la usa el navegador para dar mensajes inmediatos y el
 * servidor para no confiar en la validación del cliente (CA2).
 */

/** Quita lo que no sea dígito: "4242 4242-4242" -> "424242424242". */
export const soloDigitos = (v: string) => v.replace(/\D/g, "");

/**
 * Número de tarjeta válido: 13 a 19 dígitos y dígito verificador según el
 * algoritmo de Luhn (el mismo que usan las pasarelas reales): se recorre de
 * derecha a izquierda duplicando cada segundo dígito (si pasa de 9 se restan 9)
 * y la suma total debe ser múltiplo de 10.
 */
export function numeroTarjetaValido(numero: string): boolean {
  const d = soloDigitos(numero);
  if (d.length < 13 || d.length > 19) return false;
  let suma = 0;
  for (let i = 0; i < d.length; i++) {
    let digito = d.charCodeAt(i) - 48;
    if ((d.length - i) % 2 === 0) {
      digito *= 2;
      if (digito > 9) digito -= 9;
    }
    suma += digito;
  }
  return suma % 10 === 0;
}

/** "07/28" -> 1 de agosto de 2028 (la tarjeta vale hasta el último día de su mes); null si el formato/mes no sirve. */
const finDeMesVencimiento = (v: string): Date | null => {
  if (!/^\d{2}\/\d{2}$/.test(v)) return null;
  const mes = Number(v.slice(0, 2));
  if (mes < 1 || mes > 12) return null;
  return new Date(2000 + Number(v.slice(3, 5)), mes, 1);
};

/**
 * Datos de la tarjeta (CA1 del ticket de pago). El CVV se valida aquí en el
 * navegador y NUNCA viaja al servidor ni se guarda (CA6); el servidor recibe
 * solo nombre, número y vencimiento y vuelve a validarlos.
 */
export const datosTarjetaSchema = z.object({
  nombre: z
    .string()
    .trim()
    .min(1, "Escribe el nombre como aparece en la tarjeta."),
  numero: z
    .string()
    .trim()
    .min(1, "Escribe el número de tarjeta.")
    .regex(/^[\d\s-]+$/, "El número solo puede contener dígitos, espacios o guiones.")
    .refine(numeroTarjetaValido, "El número de tarjeta no es válido."),
  vencimiento: z
    .string()
    .trim()
    .regex(/^\d{2}\/\d{2}$/, "Usa el formato MM/AA (ej. 07/28).")
    .refine((v) => {
      const mes = Number(v.slice(0, 2));
      return mes >= 1 && mes <= 12;
    }, "El mes debe estar entre 01 y 12.")
    .refine((v) => {
      const fin = finDeMesVencimiento(v);
      return fin !== null && fin.getTime() > Date.now();
    }, "La tarjeta está vencida."),
  cvv: z.string().regex(/^\d{3,4}$/, "El CVV debe tener 3 o 4 dígitos."),
});

export type DatosTarjeta = z.infer<typeof datosTarjetaSchema>;

/** Métodos de pago permitidos por el CHECK de public.pago (Fase 3). */
export const METODOS_PAGO = [
  { id: "tarjeta_credito", nombre: "Tarjeta de crédito" },
  { id: "tarjeta_debito", nombre: "Tarjeta de débito" },
] as const;

export type MetodoPago = (typeof METODOS_PAGO)[number]["id"];

/**
 * Número de reserva visible al cliente (CA6 del registro): ORB-000123 a
 * partir del id. Es el dato que la confirmación muestra y con el que el
 * cliente puede pedir soporte.
 */
export const numeroReserva = (id: number) => `ORB-${String(id).padStart(6, "0")}`;

export const formatoFuncion = (idioma: string | null, subtitulos: boolean | null) =>
  idioma ? `${subtitulos ? "Subtitulada" : "Doblada"} ${idioma}` : "";

/** Clasificaciones de película que NO permiten entrada de niños. */
export const B15 = "B15"; // +15 años
export const C = "C"; // +18 años (peligroso)

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
