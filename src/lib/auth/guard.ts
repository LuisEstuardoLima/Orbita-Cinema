import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getRol, type Rol } from "@/lib/roles";

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

/**
 * Verifica que quien ejecuta una acción tenga alguno de los roles indicados
 * (p. ej. `["Administrador", "Colaborador"]` en /admin/funciones).
 * Misma convención que `assertAdmin`: mensaje de error, o null si puede continuar,
 * y sin validar nada mientras AUTH_GUARD != "on".
 */
export async function assertRol(roles: readonly Rol[]): Promise<string | null> {
  if (process.env.AUTH_GUARD !== "on") return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const rol = getRol(user);
  return rol && roles.includes(rol) ? null : "No tienes permisos para esta acción.";
}
