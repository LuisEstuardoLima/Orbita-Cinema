/**
 * Matriz de permisos por rol (SCRUM-116 / RNF-006 / RNF-015). ÚNICA fuente de verdad de
 * "quién puede entrar adónde": la leen el middleware, el menú del panel, el inicio del panel
 * y las páginas del servidor. Las Server Actions usan los mismos grupos de roles
 * (`ROLES_ADMIN`, `ROLES_PANEL`) con `assertAdmin` / `assertRol`.
 *
 * Es TypeScript puro (sin `server-only`) para poder usarse también en el middleware y en
 * componentes cliente. El rol de cada usuario sale de la BD (`getRol`), nunca del navegador.
 *
 * | Zona / módulo                  | Cliente | Colaborador | Administrador |
 * |--------------------------------|:-------:|:-----------:|:-------------:|
 * | Sitio público, compra, /perfil |    ✔    |      ✔      |       ✔       |
 * | /admin (inicio del panel)      |         |      ✔      |       ✔       |
 * | /admin/funciones               |         |      ✔      |       ✔       |
 * | /admin/peliculas               |         |   consulta  |       ✔       |
 * | /admin/salas (y asientos)      |         |   consulta  |       ✔       |
 * | /admin/reportes, /admin/usuarios (próximos) |   |      |       ✔       |
 *
 * "consulta" = el Colaborador puede ENTRAR y ver la información, pero no crear, editar, dar de
 * baja ni activar/desactivar nada (ver `puedeModificar`). Las Server Actions de esos módulos
 * siguen exigiendo Administrador, así que aunque alguien intente modificar sin pasar por la
 * pantalla, el servidor lo rechaza.
 *
 * Para proteger un módulo nuevo: agregar su regla aquí ANTES de `/admin`, y su `href` en
 * `lib/admin-modulos.ts` (el menú se filtra solo).
 */
import type { Rol } from "@/lib/roles";

/** Solo Administrador. */
export const ROLES_ADMIN: readonly Rol[] = ["Administrador"];
/** Panel: Colaborador y Administrador (funciones y horarios, consultas). */
export const ROLES_PANEL: readonly Rol[] = ["Colaborador", "Administrador"];

export type ReglaRuta = { prefix: string; roles: readonly Rol[] | "cualquiera" };

/** Orden importa: la primera que coincida gana, así que las rutas específicas van antes que /admin. */
export const REGLAS_RUTA: readonly ReglaRuta[] = [
  { prefix: "/admin/peliculas", roles: ROLES_PANEL }, // Colaborador: solo consulta
  { prefix: "/admin/salas", roles: ROLES_PANEL }, // Colaborador: solo consulta (incluye asientos)
  { prefix: "/admin/reportes", roles: ROLES_ADMIN },
  { prefix: "/admin/usuarios", roles: ROLES_ADMIN },
  { prefix: "/admin/funciones", roles: ROLES_PANEL },
  { prefix: "/admin", roles: ROLES_PANEL },
  { prefix: "/perfil", roles: "cualquiera" }, // requiere sesión, cualquier rol
];

/** Regla que aplica a una ruta, o undefined si es pública. */
export function reglaDeRuta(ruta: string): ReglaRuta | undefined {
  return REGLAS_RUTA.find((r) => ruta === r.prefix || ruta.startsWith(`${r.prefix}/`));
}

/** ¿Puede este rol entrar a la ruta? (las rutas sin regla son públicas) */
export function puedeAcceder(rol: Rol, ruta: string): boolean {
  const regla = reglaDeRuta(ruta);
  if (!regla) return true;
  return regla.roles === "cualquiera" || regla.roles.includes(rol);
}

/**
 * Quién puede MODIFICAR (crear, editar, dar de baja, activar/desactivar) en cada módulo.
 * Un rol que puede entrar pero no está aquí ve el módulo en modo consulta.
 */
const MODIFICAR: readonly ReglaRuta[] = [
  { prefix: "/admin/peliculas", roles: ROLES_ADMIN },
  { prefix: "/admin/salas", roles: ROLES_ADMIN },
  { prefix: "/admin/funciones", roles: ROLES_PANEL },
];

/** ¿Puede este rol crear/modificar en el módulo de la ruta? */
export function puedeModificar(rol: Rol, ruta: string): boolean {
  const regla = MODIFICAR.find((r) => ruta === r.prefix || ruta.startsWith(`${r.prefix}/`));
  if (!regla) return false;
  return regla.roles === "cualquiera" || regla.roles.includes(rol);
}

/** Pantalla de inicio de cada rol tras iniciar sesión. El Cliente va a la cartelera. */
export function inicioDeRol(rol: Rol): string {
  if (rol === "Administrador") return "/admin";
  if (rol === "Colaborador") return "/admin/funciones";
  return "/";
}
