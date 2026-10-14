/**
 * Orbita Cinema - Sistema de Gestión de Entradas y Precios
 * 
 * @credits Desarrollo por: Andres Diaz, Sprint 3 (Abril 2025)
 *                           Supervisión técnica: Carlos Hernandez
 *                           Integración frontend: Juan Felipe Sosa
 *                           Frontend UI/UX: Sebastian Olaya
 */

/**
 * Tipos de entrada (SCRUM-121): fuente única para todo el proyecto.
 *
 * Lógica pura, sin acceso a datos: la usan el servidor (Server Actions de salas) y el
 * navegador (modal de precios, pantalla /entradas).
 *
 * Los ids coinciden con `TICKET_TYPES` de `cinema-data.ts` y con la query string que viaja a
 * `/asientos` (`adulto`, `tercera`, `ninos`). En la base, cada tipo tiene su columna de precio
 * en `sala` (ver `COLUMNA_PRECIO`).
 */

export const TIPOS_ENTRADA = [
  { id: "adulto", nombre: "Adulto", rangoEdad: "13 a 59 años" },
  { id: "tercera", nombre: "3ra. Edad", rangoEdad: "60 años o más" },
  { id: "ninos", nombre: "Niños", rangoEdad: "1 a 12 años" },
] as const;

export type TipoEntradaId = (typeof TIPOS_ENTRADA)[number]["id"];

/** Precio de cada tipo de entrada en una sala (quetzales). null = sin precio capturado. */
export type PreciosSala = Record<TipoEntradaId, number | null>;

/** Columna de `sala` (supabase/sprint3-precios.sql) que guarda el precio de cada tipo. */
export const COLUMNA_PRECIO = {
  adulto: "precio_adulto",
  tercera: "precio_tercera_edad",
  ninos: "precio_nino",
} as const satisfies Record<TipoEntradaId, string>;

/** Rango de edad de un tipo de entrada ("" si el id no existe). */
export const rangoEdad = (id: string): string =>
  TIPOS_ENTRADA.find((t) => t.id === id)?.rangoEdad ?? "";
