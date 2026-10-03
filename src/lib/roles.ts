/** Roles definidos en la documentación (RF-040): Cliente, Colaborador y Administrador. */
export type Rol = "Cliente" | "Colaborador" | "Administrador";

const ROLES: readonly string[] = ["Cliente", "Colaborador", "Administrador"];

/**
 * Lee el rol desde `app_metadata.rol` del usuario de Supabase Auth
 * (solo editable desde el servidor / service role, no por el usuario).
 * Un usuario autenticado sin rol asignado se considera Cliente.
 */
export function getRol(user: { app_metadata?: Record<string, unknown> } | null): Rol | null {
  if (!user) return null;
  const rol = user.app_metadata?.["rol"];
  return typeof rol === "string" && ROLES.includes(rol) ? (rol as Rol) : "Cliente";
}
