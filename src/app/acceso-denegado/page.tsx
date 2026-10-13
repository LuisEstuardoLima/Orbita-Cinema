/**
 * Acceso denegado (SCRUM-116): a esta pantalla llega quien intenta entrar a una zona que su rol
 * no permite (el middleware y las páginas del panel redirigen aquí). No revela qué módulos existen.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { getPerfilActual } from "@/lib/auth/perfil";
import { inicioDeRol } from "@/lib/permisos";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Acceso denegado | Órbita Cinema",
  robots: { index: false, follow: false },
};

export default async function Page() {
  const perfil = await getPerfilActual();
  const inicio = perfil ? inicioDeRol(perfil.rol) : "/";
  const tienePanel = inicio !== "/";

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="card-surface w-full max-w-md rounded-xl p-8 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-destructive/15 text-destructive">
          <ShieldAlert className="h-7 w-7" />
        </span>
        <h1 className="mt-5 text-3xl tracking-wide">Acceso denegado</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          No tienes permiso para entrar a esta sección. Si crees que es un error, comunícate con un
          administrador.
        </p>
        <div className="mt-7 flex flex-col gap-3">
          {tienePanel && (
            <Link href={inicio} className="btn-primary">
              Ir a mi panel
            </Link>
          )}
          <Link href="/" className={tienePanel ? "text-sm text-muted-foreground hover:text-primary" : "btn-primary"}>
            Volver a la cartelera
          </Link>
        </div>
      </div>
    </div>
  );
}
