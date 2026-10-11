import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getRol, type Rol } from "@/lib/roles";

/**
 * Verifica que quien ejecuta una acción sea Administrador.
 * Devuelve un mensaje de error, o null si puede continuar.
 * El rol se lee de la BD (usuarios.id_rol -> rol), fuente única.
 * Con AUTH_GUARD != "on" no valida nada (compatibilidad con desarrollo sin login).
 */
export async function assertAdmin(): Promise<string | null> {
  if (process.env.AUTH_GUARD !== "on") return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "Debes iniciar sesión para realizar esta acción.";
  const rol = await getRol(supabase, user.id);
  return rol === "Administrador" ? null : "No tienes permisos para esta acción.";
}

/**
 * Verifica que quien ejecuta una acción tenga alguno de los roles indicados
 * (p. ej. `["Administrador", "Colaborador"]` en /admin/funciones).
 * Misma convención que `assertAdmin`: mensaje de error, o null si puede continuar;
 * el rol se lee de la BD y no se valida nada mientras AUTH_GUARD != "on".
 */
export async function assertRol(roles: readonly Rol[]): Promise<string | null> {
  if (process.env.AUTH_GUARD !== "on") return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "Debes iniciar sesión para realizar esta acción.";
  const rol = await getRol(supabase, user.id);
  return roles.includes(rol) ? null : "No tienes permisos para esta acción.";
}
