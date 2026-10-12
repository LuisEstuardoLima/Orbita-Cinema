/**
 * Gestión de salas — ruta `/admin/salas` (SCRUM-109).
 *
 * Este Server Component obtiene el listado de salas desde Supabase
 * y se lo pasa al componente cliente, que manejará filtros, formularios
 * y acciones de crear, editar y desactivar.
 *
 * Acceso: solo Administrador.
 */
import type { Metadata } from "next";
import { listSalasAdmin } from "@/lib/db/salas";
import { AdminSalasClient } from "./admin-salas-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Gestión de salas | Órbita Cinema",
  description:
    "Panel de Órbita Cinema para crear, editar y desactivar salas del cine.",
  robots: { index: false, follow: false },
  openGraph: {
    title: "Gestión de salas | Órbita Cinema",
    description: "Panel administrativo para gestionar salas.",
  },
};

export default async function Page() {
  const salas = await listSalasAdmin();

  return <AdminSalasClient salas={salas} />;
}