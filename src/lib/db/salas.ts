import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SalaRow } from "@/lib/db-types";
import { COLUMNA_PRECIO, type PreciosSala } from "@/lib/entradas";

/**
 * SCRUM-109: consultas del módulo /admin/salas.
 *
 * Se usa la service role porque el panel administrativo debe poder ver
 * tanto salas activas como inactivas.
 */

export type SalaAdmin = {
  id: number;
  nombre: string;
  // Opción A: derivada de la distribución de asientos (SCRUM-110).
  // 0 o NULL = sala sin plano configurado (se muestra "Sin asientos configurados").
  capacidad: number | null;
  tipo: string;
  activa: boolean;
  /** true si la sala ya tiene un plano de asientos guardado (SCRUM-110). */
  tieneAsientos: boolean;
  /** SCRUM-121: precio por tipo de entrada (null = sin precio capturado). */
  precios: PreciosSala;
};

const COLUMNAS_SALA = "id, nombre, capacidad, tipo_sala, activa";
const COLUMNAS_PRECIO = Object.values(COLUMNA_PRECIO).join(", ");

/** numeric de Postgres puede llegar como número o como texto: se normaliza a number | null. */
const aPrecio = (valor: unknown): number | null =>
  valor == null || valor === "" || Number.isNaN(Number(valor)) ? null : Number(valor);

/**
 * Lee las salas con sus precios. Si las columnas de precio todavía no existen
 * (sprint3-precios.sql aún no corrido por alguien del equipo), Postgres
 * responde 42703 (undefined_column) y se vuelve a leer sin ellas: los precios
 * quedan en null y el panel no se cae, igual que con la tabla `asiento`.
 */
async function leerSalas(admin: ReturnType<typeof createAdminClient>) {
  const conPrecios = await admin
    .from("sala")
    .select(`${COLUMNAS_SALA}, ${COLUMNAS_PRECIO}`)
    .order("id");

  if (conPrecios.error?.code !== "42703") return conPrecios;

  return admin.from("sala").select(COLUMNAS_SALA).order("id");
}

/**
 * Orden natural por nombre: compara los números como números, así que
 * "Sala 2" queda antes que "Sala 10" (el orden alfabético simple de SQL
 * las intercambiaría). Se hace con Intl.Collator para no depender de la
 * colación de la base.
 */
const ordenNatural = new Intl.Collator("es", {
  numeric: true,
  sensitivity: "base",
});

/**
 * Lista todas las salas para el panel administrativo,
 * ordenadas por nombre de forma natural (Sala 1, Sala 2, … Sala 10).
 * Además marca qué salas ya tienen un plano de asientos guardado
 * (`tieneAsientos`). Opción A: la capacidad nunca es manual, solo se deriva
 * de la distribución (SCRUM-110); 0 o NULL = sin plano.
 */
export async function listSalasAdmin(): Promise<SalaAdmin[]> {
  const admin = createAdminClient();

  const [salas, conAsientos] = await Promise.all([
    leerSalas(admin),
    // Ids de sala que ya tienen al menos un asiento guardado.
    admin.from("asiento").select("id_sala").eq("retirado", false),
  ]);

  if (salas.error) {
    throw new Error(`sala: ${salas.error.message}`);
  }

  const idsConAsientos = new Set(
    // Si la tabla `asiento` todavía no existe (migración de SCRUM-110 aún
    // no corrida por alguien del equipo), degradamos con elegancia: ninguna
    // sala se marca con plano y la capacidad sigue siendo manual. Así el
    // panel no se cae para quien aún no aplicó el SQL.
    conAsientos.error
      ? []
      : (conAsientos.data ?? []).map(
          (a) => (a as { id_sala: number }).id_sala,
        ),
  );

  // Sin las columnas de precio, esos campos llegan undefined y aPrecio los deja en null.
  return (salas.data as unknown as SalaRow[])
    .map((s) => ({
      id: s.id,
      nombre: s.nombre,
      capacidad: s.capacidad,
      tipo: s.tipo_sala ?? "",
      activa: s.activa ?? false,
      tieneAsientos: idsConAsientos.has(s.id),
      precios: {
        adulto: aPrecio(s.precio_adulto),
        tercera: aPrecio(s.precio_tercera_edad),
        ninos: aPrecio(s.precio_nino),
      },
    }))
    .sort((a, b) => ordenNatural.compare(a.nombre, b.nombre));
}

/**
 * Cuenta cuántas salas activas existen.
 * Se usará en las Server Actions para validar el límite máximo de 10.
 */
export async function contarSalasActivas(): Promise<number> {
  const admin = createAdminClient();

  const { count, error } = await admin
    .from("sala")
    .select("id", { count: "exact", head: true })
    .eq("activa", true);

  if (error) {
    throw new Error(`sala: ${error.message}`);
  }

  return count ?? 0;
}