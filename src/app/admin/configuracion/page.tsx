import type { Metadata } from "next";
import { exigirRol } from "@/lib/auth/pagina";
import { ROLES_ADMIN } from "@/lib/permisos";
import { getConfiguracionSistema } from "@/lib/db/configuracion";
import { AdminConfiguracionClient } from "./admin-configuracion-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Configuración | Órbita Cinema",
  description:
    "Panel administrativo para configurar parámetros generales de Órbita Cinema.",
  robots: {
    index: false,
    follow: false,
  },
};

/**
 * SCRUM-139:
 * configuración general accesible únicamente para Administradores.
 */
export default async function Page() {
  await exigirRol(
    ROLES_ADMIN,
    "/admin/configuracion",
  );

  const configuracion =
    await getConfiguracionSistema();

  return (
    <AdminConfiguracionClient
      porcentajeRecargo={
        configuracion.porcentajeRecargo
      }
    />
  );
}