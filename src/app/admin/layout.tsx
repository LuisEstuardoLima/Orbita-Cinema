/**
 * Layout común del panel administrativo (SCRUM-112): encabezado + menú + contenido.
 *
 * Todo lo que viva bajo `/admin/*` (películas hoy; funciones y salas cuando existan) se renderiza
 * dentro de este layout sin que el equipo tenga que repetir encabezado ni menú.
 *
 * Es un Server Component: el único trozo con estado del navegador es `AdminNav`.
 * El panel no aparece en la navegación pública (RNF-015); el acceso lo controla `src/middleware.ts`.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { CircleUserRound, ExternalLink, Film } from "lucide-react";
import { AdminNav } from "@/components/admin/AdminNav";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
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
              <CircleUserRound className="h-6 w-6" /> Usuario Id
            </span>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1400px] gap-6 px-6 py-8 lg:grid-cols-[260px_1fr] lg:gap-8">
        <AdminNav />
        <main className="min-w-0">{children}</main>
      </div>
    </div>
  );
}
