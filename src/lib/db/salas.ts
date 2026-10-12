import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SalaRow } from "@/lib/db-types";

/**
 * SCRUM-109: consultas del módulo /admin/salas.
 *
 * Se usa la service role porque el panel administrativo debe poder ver
 * tanto salas activas como inactivas.
 */

export type SalaAdmin = {
  id: number;
  nombre: string;
  capacidad: number;
  tipo: string;
  activa: boolean;
};

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
 */
export async function listSalasAdmin(): Promise<SalaAdmin[]> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("sala")
    .select("id, nombre, capacidad, tipo_sala, activa")
    .order("id");

  if (error) {
    throw new Error(`sala: ${error.message}`);
  }

  return (data as SalaRow[])
    .map((s) => ({
      id: s.id,
      nombre: s.nombre,
      capacidad: s.capacidad,
      tipo: s.tipo_sala ?? "",
      activa: s.activa ?? false,
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