"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { INICIO_ADMIN, MODULOS_ADMIN, esActivo } from "@/lib/admin-modulos";
import { puedeAcceder } from "@/lib/permisos";
import type { Rol } from "@/lib/roles";

export function AdminNav({ rol }: { rol: Rol | null }) {
  const pathname = usePathname();
  const visibles = [INICIO_ADMIN, ...MODULOS_ADMIN].filter((m) =>
    rol === null || puedeAcceder(rol, m.href)
  );

  return (
    <nav aria-label="Módulos del panel" className="card-surface overflow-hidden lg:h-fit">
      <h2 className="hidden border-b border-border px-5 py-4 text-2xl tracking-wide lg:block">Navegación</h2>
      <ul className="flex overflow-x-auto lg:block lg:overflow-visible">
        {visibles.map((m) => {
          const Icono = m.icono;
          const activo = esActivo(m.href, pathname);
          const base = "flex w-full items-center gap-3 whitespace-nowrap border-b-4 px-5 py-3 text-sm transition-colors lg:border-b-0 lg:border-l-4";

          return (
            <li key={m.href} className="shrink-0 lg:shrink">
              {m.disponible ? (
                <Link
                  href={m.href}
                  aria-current={activo ? "page" : undefined}
                  className={`${base} ${
                    activo
                      ? "border-primary bg-surface-2 font-semibold text-primary"
                      : "border-transparent text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                  }`}
                >
                  <Icono className="h-4 w-4" />
                  {m.nombre}
                </Link>
              ) : (
                <span
                  aria-disabled="true"
                  title="Próximamente"
                  className={`${base} cursor-not-allowed border-transparent text-muted-foreground/50`}
                >
                  <Icono className="h-4 w-4" />
                  {m.nombre}
                  <span className="ml-auto rounded bg-surface-2 px-1.5 py-0.5 text-[10px] uppercase tracking-wider">Pronto</span>
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}