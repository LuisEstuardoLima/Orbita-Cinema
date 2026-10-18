import type { Metadata } from "next";
import { esSoloLectura, exigirRol } from "@/lib/auth/pagina";
import { ROLES_PANEL } from "@/lib/permisos";
import { listarUsuariosAdmin } from "@/lib/db/usuarios";
import { AdminUsuariosClient } from "./admin-usuarios-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Gestión de usuarios | Órbita Cinema",
  description:
    "Panel de administración de Órbita Cinema para consultar y gestionar usuarios y sus roles.",
  robots: { index: false, follow: false },
};

export default async function Page() {
  await exigirRol(ROLES_PANEL, "/admin/usuarios");
  const usuarios = await listarUsuariosAdmin();
  return (
    <AdminUsuariosClient
      usuarios={usuarios}
      soloLectura={await esSoloLectura("/admin/usuarios")}
    />
  );
}
