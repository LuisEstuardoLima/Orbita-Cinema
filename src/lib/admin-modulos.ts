import {
  BarChart3,
  Clapperboard,
  DoorOpen,
  Film,
  LayoutDashboard,
  ScanLine,
  Settings,
  Users,
  type LucideIcon,
} from "lucide-react";

/**
 * Módulos del panel administrativo (SCRUM-112 / SCRUM-139 / SCRUM-135).
 *
 * Es la ÚNICA lista que alimenta el menú lateral (`AdminNav`)
 * y las tarjetas de la página de inicio (`/admin`).
 *
 * Para sumar un módulo:
 * 1. crear su carpeta en `src/app/admin/<modulo>/page.tsx`;
 * 2. registrar aquí su entrada;
 * 3. configurar sus permisos en `src/lib/permisos.ts`.
 *
 * Mientras `disponible` sea false, se muestra como "Próximamente"
 * y no funciona como enlace.
 */
export type ModuloAdmin = {
  href: string;
  nombre: string;
  descripcion: string;
  icono: LucideIcon;
  disponible: boolean;
};

export const INICIO_ADMIN: ModuloAdmin = {
  href: "/admin",
  nombre: "Inicio",
  descripcion:
    "Resumen y accesos del panel.",
  icono: LayoutDashboard,
  disponible: true,
};

export const MODULOS_ADMIN: ModuloAdmin[] = [
  {
    href: "/admin/peliculas",
    nombre: "Películas",
    descripcion:
      "Registrar, editar, activar y eliminar películas de la cartelera.",
    icono: Film,
    disponible: true,
  },
  {
    href: "/admin/funciones",
    nombre: "Funciones",
    descripcion:
      "Programar funciones y horarios por película y sala.",
    icono: Clapperboard,
    disponible: true,
  },
  {
    href: "/admin/entradas",
    nombre: "Entradas",
    descripcion:
      "Consultar entradas vendidas, buscar reservas y validar el ingreso de clientes.",
    icono: ScanLine,
    disponible: true,
  },
  {
    href: "/admin/salas",
    nombre: "Salas y asientos",
    descripcion:
      "Gestionar salas, su capacidad y la distribución de asientos.",
    icono: DoorOpen,
    disponible: true,
  },
  {
    href: "/admin/configuracion",
    nombre: "Configuración",
    descripcion:
      "Configurar parámetros generales del sistema, como el porcentaje de recargo.",
    icono: Settings,
    disponible: true,
  },
  {
    href: "/admin/reportes",
    nombre: "Reportes",
    descripcion:
      "Ventas y reservas por función o película, y ocupación por sala, con descarga en Excel.",
    icono: BarChart3,
    disponible: true,
  },
  {
    href: "/admin/usuarios",
    nombre: "Usuarios",
    descripcion:
      "Cuentas de clientes, colaboradores y administradores.",
    icono: Users,
    disponible: true,
  },
];

/**
 * ¿Está activa esta opción del menú para la ruta actual?
 * Inicio solo coincide exactamente con `/admin`.
 */
export function esActivo(
  href: string,
  pathname: string,
): boolean {
  if (
    href === INICIO_ADMIN.href
  ) {
    return pathname === href;
  }

  return (
    pathname === href ||
    pathname.startsWith(
      `${href}/`,
    )
  );
}