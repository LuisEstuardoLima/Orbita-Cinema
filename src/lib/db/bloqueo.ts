import "server-only";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import type { BloqueoVigente } from "@/lib/bloqueo";

/**
 * SCRUM-119: acceso a datos del bloqueo temporal de asientos.
 *
 * El bloqueo es de quien tiene la cookie `orbita_bloqueo` (un uuid aleatorio que crea el
 * servidor al presionar "Continuar" y se guarda en `reserva.token_sesion`). Sirve igual para
 * cliente registrado e invitado, y no se puede adivinar: nunca se confía en un id que venga de
 * la URL. Todo pasa por funciones SQL (supabase/sprint3-bloqueo-asientos.sql) con la service
 * role, que hacen cada paso de forma atómica.
 */

export const COOKIE_BLOQUEO = "orbita_bloqueo";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Token del bloqueo del navegador actual, o null si no tiene (o la cookie es inválida). */
export async function getTokenBloqueo(): Promise<string | null> {
  const valor = (await cookies()).get(COOKIE_BLOQUEO)?.value;
  return valor && UUID.test(valor) ? valor : null;
}

/** Guarda el token en una cookie del navegador (solo servidor: httpOnly). */
export async function guardarTokenBloqueo(token: string): Promise<void> {
  (await cookies()).set(COOKIE_BLOQUEO, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60, // la cookie dura más que el bloqueo (5 min); el vencimiento lo decide la BD
  });
}

/** Bloqueo vigente (no vencido) del navegador actual, o null. El tiempo restante lo calcula la BD. */
export async function getBloqueoVigente(): Promise<BloqueoVigente | null> {
  const token = await getTokenBloqueo();
  if (!token) return null;

  const { data, error } = await createAdminClient().rpc("bloqueo_vigente", { p_token: token });
  if (error) throw new Error(`bloqueo_vigente: ${error.message}`);
  if (!data) return null;

  const d = data as {
    id_reserva: number;
    id_funcion: number;
    total: number;
    segundos_restantes: number;
    asientos: { id: number; fila: string; numero: number }[];
  };
  return {
    idReserva: d.id_reserva,
    idFuncion: d.id_funcion,
    total: Number(d.total),
    segundosRestantes: d.segundos_restantes,
    asientos: d.asientos,
  };
}

/** Libera de inmediato el bloqueo del navegador actual (si lo hay). */
export async function liberarBloqueoActual(): Promise<void> {
  const token = await getTokenBloqueo();
  if (!token) return;
  const { error } = await createAdminClient().rpc("liberar_bloqueo", { p_token: token });
  if (error) throw new Error(`liberar_bloqueo: ${error.message}`);
}
