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
 * Lista todas las salas para el panel administrativo.
 * Las activas se muestran primero y luego se ordenan por nombre.
 */
export async function listSalasAdmin(): Promise<SalaAdmin[]> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("sala")
    .select("id, nombre, capacidad, tipo_sala, activa")
    .order("activa", { ascending: false })
    .order("nombre");

  if (error) {
    throw new Error(`sala: ${error.message}`);
  }

  return (data as SalaRow[]).map((s) => ({
    id: s.id,
    nombre: s.nombre,
    capacidad: s.capacidad,
    tipo: s.tipo_sala ?? "",
    activa: s.activa ?? false,
  }));
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