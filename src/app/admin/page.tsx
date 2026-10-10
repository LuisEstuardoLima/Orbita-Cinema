/**
 * Página de inicio del panel — ruta `/admin` (SCRUM-112).
 * Muestra un acceso por cada módulo de `lib/admin-modulos.ts`; los que aún no existen salen
 * como "Próximamente" y no son enlaces.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { MODULOS_ADMIN } from "@/lib/admin-modulos";

export const metadata: Metadata = {
  title: "Panel de administración | Órbita Cinema",
  description: "Accesos a los módulos de gestión de Órbita Cinema.",
  robots: { index: false, follow: false },
};

export default function Page() {
  return (
    <section>
      <h1 className="text-3xl tracking-wide">Panel de administración</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Elige un módulo para gestionar la información del cine.
      </p>

      <div className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {MODULOS_ADMIN.map((m) => {
          const Icono = m.icono;
          const contenido = (
            <>
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <Icono className="h-6 w-6" />
              </span>
              <h2 className="mt-4 text-2xl tracking-wide">{m.nombre}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{m.descripcion}</p>
              {m.disponible ? (
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
                  Abrir <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
              ) : (
                <span className="mt-4 inline-block rounded bg-surface-2 px-2 py-1 text-xs uppercase tracking-wider text-muted-foreground">
                  Próximamente
                </span>
              )}
            </>
          );

          return m.disponible ? (
            <Link
              key={m.href}
              href={m.href}
              className="card-surface group block p-6 transition-all hover:-translate-y-1 hover:border-primary"
            >
              {contenido}
            </Link>
          ) : (
            <div key={m.href} aria-disabled="true" className="card-surface p-6 opacity-60">
              {contenido}
            </div>
          );
        })}
      </div>
    </section>
  );
}
