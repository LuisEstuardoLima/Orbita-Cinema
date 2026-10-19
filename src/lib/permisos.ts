/**
 * Matriz de permisos por rol (SCRUM-116 / RNF-006 / RNF-015 / SCRUM-139).
 * ÚNICA fuente de verdad de "quién puede entrar adónde":
 * la leen el middleware, el menú del panel, el inicio del panel
 * y las páginas del servidor.
 *
 * Las Server Actions usan los mismos grupos de roles
 * (`ROLES_ADMIN`, `ROLES_PANEL`) con `assertAdmin` / `assertRol`.
 *
 * Es TypeScript puro (sin `server-only`) para poder usarse también
 * en el middleware y en componentes cliente.
 *
 * El rol de cada usuario sale de la BD (`getRol`), nunca del navegador.
 *
 * | Zona / módulo                  | Cliente | Colaborador | Administrador |
 * |--------------------------------|:-------:|:-----------:|:-------------:|
 * | Sitio público, compra, /perfil |    ✔    |      ✔      |       ✔       |
 * | /admin (inicio del panel)      |         |      ✔      |       ✔       |
 * | /admin/funciones               |         |      ✔      |       ✔       |
 * | /admin/peliculas               |         |   consulta  |       ✔       |
 * | /admin/salas (y asientos)      |         |   consulta  |       ✔       |
 * | /admin/configuracion           |         |             |       ✔       |
 * | /admin/reportes (próximos)     |         |             |       ✔       |
 * | /admin/usuarios                |         |   consulta  |       ✔       |
 *
 * "consulta" = el Colaborador puede ENTRAR y ver la información,
 * pero no crear, editar, dar de baja ni activar/desactivar nada
 * (ver `puedeModificar`).
 *
 * Las Server Actions de esos módulos siguen exigiendo el rol apropiado,
 * así que aunque alguien intente modificar sin pasar por la pantalla,
 * el servidor lo rechaza.
 *
 * Para proteger un módulo nuevo:
 * agregar su regla aquí ANTES de `/admin`,
 * y su `href` en `lib/admin-modulos.ts`.
 */
import type { Rol } from "@/lib/roles";

/** Solo Administrador. */
export const ROLES_ADMIN: readonly Rol[] = [
  "Administrador",
];

/** Panel: Colaborador y Administrador. */
export const ROLES_PANEL: readonly Rol[] = [
  "Colaborador",
  "Administrador",
];

export type ReglaRuta = {
  prefix: string;
  roles:
    | readonly Rol[]
    | "cualquiera";
};

/**
 * Orden importa:
 * la primera regla que coincida gana,
 * por eso las rutas específicas van antes que `/admin`.
 */
export const REGLAS_RUTA: readonly ReglaRuta[] = [
  {
    prefix: "/admin/peliculas",
    roles: ROLES_PANEL,
  },
  {
    prefix: "/admin/salas",
    roles: ROLES_PANEL,
  },
  {
    prefix: "/admin/configuracion",
    roles: ROLES_ADMIN,
  },
  {
    prefix: "/admin/reportes",
    roles: ROLES_ADMIN,
  },
  {
    prefix: "/admin/usuarios",
    roles: ROLES_PANEL,
  },
  {
    prefix: "/admin/funciones",
    roles: ROLES_PANEL,
  },
  {
    prefix: "/admin",
    roles: ROLES_PANEL,
  },
  {
    prefix: "/perfil",
    roles: "cualquiera",
  },
];

/**
 * Regla que aplica a una ruta,
 * o undefined si la ruta es pública.
 */
export function reglaDeRuta(
  ruta: string,
): ReglaRuta | undefined {
  return REGLAS_RUTA.find(
    (r) =>
      ruta === r.prefix ||
      ruta.startsWith(
        `${r.prefix}/`,
      ),
  );
}

/**
 * ¿Puede este rol entrar a la ruta?
 * Las rutas sin regla son públicas.
 */
export function puedeAcceder(
  rol: Rol,
  ruta: string,
): boolean {
  const regla =
    reglaDeRuta(ruta);

  if (!regla) {
    return true;
  }

  return (
    regla.roles === "cualquiera" ||
    regla.roles.includes(rol)
  );
}

/**
 * Quién puede MODIFICAR en cada módulo.
 *
 * Un rol que puede entrar pero no aparece aquí
 * puede utilizar el módulo únicamente en modo consulta.
 */
const MODIFICAR: readonly ReglaRuta[] = [
  {
    prefix: "/admin/peliculas",
    roles: ROLES_ADMIN,
  },
  {
    prefix: "/admin/salas",
    roles: ROLES_ADMIN,
  },
  {
    prefix: "/admin/configuracion",
    roles: ROLES_ADMIN,
  },
  {
    prefix: "/admin/funciones",
    roles: ROLES_PANEL,
  },
  {
    prefix: "/admin/usuarios",
    roles: ROLES_ADMIN,
  },
];

/**
 * ¿Puede este rol crear o modificar
 * información en el módulo de la ruta?
 */
export function puedeModificar(
  rol: Rol,
  ruta: string,
): boolean {
  const regla =
    MODIFICAR.find(
      (r) =>
        ruta === r.prefix ||
        ruta.startsWith(
          `${r.prefix}/`,
        ),
    );

  if (!regla) {
    return false;
  }

  return (
    regla.roles === "cualquiera" ||
    regla.roles.includes(rol)
  );
}

/**
 * Pantalla de inicio de cada rol
 * después de iniciar sesión.
 */
export function inicioDeRol(
  rol: Rol,
): string {
  if (rol === "Administrador") {
    return "/admin";
  }

  if (rol === "Colaborador") {
    return "/admin/funciones";
  }

  return "/";
}