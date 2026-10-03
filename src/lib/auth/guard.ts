import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getRol } from "@/lib/roles";

/**
 * Verifica que quien ejecuta una acción sea Administrador.
 * Devuelve un mensaje de error, o null si puede continuar.
 * Con AUTH_GUARD != "on" no valida nada (el login es del Sprint 2).
 */
export async function assertAdmin(): Promise<string | null> {
  if (process.env.AUTH_GUARD !== "on") return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return getRol(user) === "Administrador" ? null : "No tienes permisos para esta acción.";
}
