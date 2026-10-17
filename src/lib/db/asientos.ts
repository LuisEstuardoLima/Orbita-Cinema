import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { ahoraGuatemala } from "@/lib/fechas";
import type { AsientoRow } from "@/lib/db-types";

/**
 * SCRUM-110: consultas del plano físico de asientos de una sala.
 *
 * `asiento` es la capa física (qué asientos existen y su naturaleza:
 * normal · pasillo · deshabilitado). NO guarda ventas: la disponibilidad por
 * función se calculará en el Sprint 3 restando las reservas.
 *
 * Igual que el resto del panel admin, se usa la service role para poder
 * configurar salas y leer su distribución completa.
 */

export type EstadoAsiento = AsientoRow["estado"];

/** Distribución guardada de una sala (vacía si nunca se configuró). */
export async function getDistribucionAsientos(
  salaId: number,
): Promise<AsientoRow[]> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("asiento")
    .select("id, id_sala, fila, numero, estado")
    .eq("id_sala", salaId)
    .order("fila")
    .order("numero");

  if (error) {
    throw new Error(`asiento: ${error.message}`);
  }

  return data as AsientoRow[];
}

/** ¿La sala ya tiene una distribución de asientos guardada? */
export async function salaTieneAsientos(salaId: number): Promise<boolean> {
  const admin = createAdminClient();

  const { count, error } = await admin
    .from("asiento")
    .select("id", { count: "exact", head: true })
    .eq("id_sala", salaId);

  if (error) {
    throw new Error(`asiento: ${error.message}`);
  }

  return (count ?? 0) > 0;
}

/**
 * ¿La sala tiene alguna función activa por venir? Si es así, no se permite
 * re-configurar la distribución (podría mover/pasillizar un asiento ya
 * implicado en una función futura). Es la versión actual de "ya tiene
 * reservas" del ticket; cuando exista `reserva` (Sprint 3) se refina.
 *
 * Solo cuentan las funciones de hoy en adelante (`fecha >= hoy`), igual que
 * el listado del panel: una función que ya ocurrió no debe bloquear la
 * edición del plano, aunque siga marcada como activa.
 */
export async function salaTieneFuncionesActivas(
  salaId: number,
): Promise<boolean> {
  const admin = createAdminClient();
  const hoy = ahoraGuatemala().fecha;

  const { count, error } = await admin
    .from("funcion")
    .select("id", { count: "exact", head: true })
    .eq("id_sala", salaId)
    .eq("activa", true)
    .gte("fecha", hoy);

  if (error) {
    throw new Error(`funcion: ${error.message}`);
  }

  return (count ?? 0) > 0;
}

/**
 * SCRUM-118 / SCRUM-119: asientos NO disponibles de una función, como `id_asiento`.
 *
 * Cuentan los ya reservados (pagados) y los bloqueados por una compra en curso que TODAVÍA no
 * vence: un bloqueo vencido no cuenta, así los asientos vuelven a estar libres para todos
 * (función SQL `asientos_no_disponibles`, ver supabase/sprint3-bloqueo-asientos.sql).
 *
 * `excluirToken`: no cuenta el bloqueo de ese cliente, para que al regresar a elegir asientos
 * no vea los suyos como ocupados.
 *
 * Lee con service role porque `detalle_reserva` solo concede SELECT a authenticated y ALL a
 * service_role.
 */
export async function getAsientosOcupadosFuncion(
  idFuncion: number,
  excluirToken: string | null = null,
): Promise<number[]> {
  const admin = createAdminClient();

  const { data, error } = await admin.rpc("asientos_no_disponibles", {
    p_funcion: idFuncion,
    p_excluir_token: excluirToken,
  });

  if (error) {
    throw new Error(`asientos_no_disponibles: ${error.message}`);
  }

  return (data as number[] | null) ?? [];
}
