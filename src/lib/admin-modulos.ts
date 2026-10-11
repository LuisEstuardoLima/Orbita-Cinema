import { Clapperboard, DoorOpen, Film, LayoutDashboard, Users, BarChart3, type LucideIcon } from "lucide-react";

/**
 * Módulos del panel administrativo (SCRUM-112). Es la ÚNICA lista que alimenta el menú lateral
 * (`AdminNav`) y las tarjetas de la página de inicio (`/admin`).
 *
 * Para sumar un módulo: crear su carpeta en `src/app/admin/<modulo>/page.tsx` (queda dentro del
 * layout común automáticamente) y poner `disponible: true` en su entrada. Mientras esté en
 * `false` se muestra como "Próximamente" y no es un enlace, así nadie cae en un 404.
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
  descripcion: "Resumen y accesos del panel.",
  icono: LayoutDashboard,
  disponible: true,
};

export const MODULOS_ADMIN: ModuloAdmin[] = [
  {
    href: "/admin/peliculas",
    nombre: "Películas",
    descripcion: "Registrar, editar, activar y eliminar películas de la cartelera.",
    icono: Film,
    disponible: true,
  },
  {
    href: "/admin/funciones",
    nombre: "Funciones",
    descripcion: "Programar funciones y horarios por película y sala.",
    icono: Clapperboard,
    disponible: false,
  },
  {
    href: "/admin/salas",
    nombre: "Salas y asientos",
    descripcion: "Gestionar salas, su capacidad y la distribución de asientos.",
    icono: DoorOpen,
    disponible: false,
  },
  {
    href: "/admin/reportes",
    nombre: "Reportes",
    descripcion: "Ventas, reservas y ocupación por función o película.",
    icono: BarChart3,
    disponible: false,
  },
  {
    href: "/admin/usuarios",
    nombre: "Usuarios",
    descripcion: "Cuentas de clientes, colaboradores y administradores.",
    icono: Users,
    disponible: false,
  },
];

/** ¿Está activa esta opción del menú para la ruta actual? Inicio solo coincide exacto. */
export function esActivo(href: string, pathname: string): boolean {
  if (href === INICIO_ADMIN.href) return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}
