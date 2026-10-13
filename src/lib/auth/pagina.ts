import "server-only";
import { redirect } from "next/navigation";
import type { Rol } from "@/lib/roles";
import { getPerfilActual } from "@/lib/auth/perfil";
import { puedeModificar } from "@/lib/permisos";

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

/**
 * ¿Debe la pantalla mostrarse en modo consulta (sin botones de crear/editar/baja)?
 * Verdadero si hay sesión y el rol puede ver el módulo pero no modificarlo (Colaborador en
 * Películas y Salas). Es solo la parte visual: las Server Actions son las que rechazan.
 * Con AUTH_GUARD != "on" (desarrollo sin login) nunca hay modo consulta.
 */
export async function esSoloLectura(ruta: string): Promise<boolean> {
  if (process.env.AUTH_GUARD !== "on") return false;
  const perfil = await getPerfilActual();
  return !!perfil && !puedeModificar(perfil.rol, ruta);
}
