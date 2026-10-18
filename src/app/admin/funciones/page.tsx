/**
 * Gestión de funciones — ruta `/admin/funciones` (SCRUM-111).
 *
 * Server Component mínimo, igual que `/admin/peliculas`: pide al servidor el listado y las
 * opciones del formulario (solo películas y salas activas) y se los pasa al componente cliente.
 * Se renderiza dentro de `admin/layout.tsx` (SCRUM-112), que pone el encabezado y el menú.
 *
 * Acceso: Administrador y Colaborador. `src/middleware.ts` ya cubre `/admin/*` con esos dos
 * roles, y las Server Actions lo vuelven a verificar con `assertRol`; ambos SOLO si
 * `AUTH_GUARD=on`. Ver el README.
 */
import type { Metadata } from "next";
import { exigirRol } from "@/lib/auth/pagina";
import { ROLES_PANEL } from "@/lib/permisos";
import { listFuncionesAdmin, listOpcionesFuncion } from "@/lib/db/funciones";
import { type SP } from "@/lib/search-params";
import { AdminFuncionesClient } from "./admin-funciones-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Gestión de funciones | Órbita Cinema",
  description:
    "Panel de Órbita Cinema para programar, modificar y cancelar funciones de la cartelera.",
  robots: { index: false, follow: false },
  openGraph: {
    title: "Gestión de funciones | Órbita Cinema",
    description: "Panel de programación de funciones.",
  },
};

export default async function Page({ searchParams }: { searchParams: Promise<SP> }) {
  await exigirRol(ROLES_PANEL, "/admin/funciones");
  const sp = await searchParams;
  const params: {
    fechaDesde?: string;
    fechaHasta?: string;
    estado?: "todas" | "activas" | "canceladas" | "finalizadas";
  } = {};
  if (sp["fechaDesde"]) params.fechaDesde = String(sp["fechaDesde"]);
  if (sp["fechaHasta"]) params.fechaHasta = String(sp["fechaHasta"]);
  if (sp["estado"]) params.estado = String(sp["estado"]) as "todas" | "activas" | "canceladas" | "finalizadas";

  const [{ hoy, funciones }, { peliculas, salas }] = await Promise.all([
    listFuncionesAdmin(params),
    listOpcionesFuncion(),
  ]);
  return (
    <AdminFuncionesClient
      hoy={hoy}
      funciones={funciones}
      peliculas={peliculas}
      salas={salas}
      fechaDesde={params.fechaDesde ?? ""}
      fechaHasta={params.fechaHasta ?? ""}
      estado={params.estado ?? "todas"}
    />
  );
}
