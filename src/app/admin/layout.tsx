/**
 * Layout común del panel administrativo (SCRUM-112): encabezado + menú + contenido.
 *
 * Todo lo que viva bajo `/admin/*` (películas hoy; funciones y salas cuando existan) se renderiza
 * dentro de este layout sin que el equipo tenga que repetir encabezado ni menú.
 *
 * Es un Server Component: el único trozo con estado del navegador es `AdminNav`.
 * El panel no aparece en la navegación pública (RNF-015); el acceso lo controla `src/middleware.ts`
 * con la matriz de `src/lib/permisos.ts`. El encabezado muestra nombre y rol (SCRUM-116) y el
 * menú se filtra por rol.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { CircleUserRound, ExternalLink, Film, LogOut } from "lucide-react";
import { AdminNav } from "@/components/admin/AdminNav";
import { getPerfilActual } from "@/lib/auth/perfil";
import { cerrarSesion } from "@/lib/auth/actions";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Nombre y rol de quien tiene la sesión (null si no hay: solo ocurre con AUTH_GUARD=off).
  const perfil = await getPerfilActual();
  const nombreCompleto = perfil ? `${perfil.nombre} ${perfil.apellido}`.trim() : "";

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between gap-4 px-6">
          <Link href="/admin" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Film className="h-5 w-5" />
            </span>
            <span className="font-display text-2xl tracking-widest">
              ÓRBITA <span className="text-primary">CINEMA</span>
              <span className="ml-2 hidden text-base text-muted-foreground sm:inline">· Administración</span>
            </span>
          </Link>
          <div className="flex items-center gap-5 text-sm">
            <Link
              href="/"
              className="hidden items-center gap-1.5 text-muted-foreground transition-colors hover:text-primary sm:flex"
            >
              <ExternalLink className="h-4 w-4" /> Ver sitio
            </Link>
            <span className="flex items-center gap-2 text-secondary">
              <CircleUserRound className="h-6 w-6" />
              {perfil ? (
                <span className="flex flex-col leading-tight">
                  <span className="font-semibold">{nombreCompleto || "Usuario"}</span>
                  <span className="text-xs uppercase tracking-wider text-muted-foreground">{perfil.rol}</span>
                </span>
              ) : (
                "Sin sesión"
              )}
            </span>
            {perfil && (
              <form action={cerrarSesion}>
                <button type="submit" aria-label="Cerrar sesión" className="px-4 py-2 text-sm flex items-center gap-2 text-muted-foreground hover:text-destructive transition-colors cursor-pointer">
                  <LogOut className="h-5 w-5" />
                  <span className="hidden sm:inline">Cerrar sesión</span>
                </button>
              </form>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1400px] gap-6 px-6 py-8 lg:grid-cols-[260px_1fr] lg:gap-8">
        <AdminNav rol={perfil?.rol ?? null} />
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
