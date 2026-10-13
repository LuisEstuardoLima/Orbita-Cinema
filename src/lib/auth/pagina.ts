import "server-only";
import { redirect } from "next/navigation";
import type { Rol } from "@/lib/roles";
import { getPerfilActual } from "@/lib/auth/perfil";

/**
 * Segunda barrera (SCRUM-116): cada página del panel vuelve a verificar el rol en el servidor,
 * por si el middleware no se ejecuta. Mismo criterio que el middleware:
 * sin sesión -> /login; con sesión pero sin permiso -> /acceso-denegado.
 * Con AUTH_GUARD != "on" no valida nada (desarrollo sin login).
 */
export async function exigirRol(roles: readonly Rol[], ruta: string): Promise<void> {
  if (process.env.AUTH_GUARD !== "on") return;
  const perfil = await getPerfilActual();
  if (!perfil) redirect(`/login?next=${encodeURIComponent(ruta)}`);
  if (!roles.includes(perfil.rol)) redirect("/acceso-denegado");
}
