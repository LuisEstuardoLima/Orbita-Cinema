"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Pestañas entre los reportes del panel (SCRUM-142 ventas y reservas, SCRUM-143 ocupación). */
const PESTANAS = [
  { href: "/admin/reportes", etiqueta: "Ventas y reservas", exacta: true },
  { href: "/admin/reportes/ocupacion", etiqueta: "Ocupación por sala", exacta: false },
];

export function ReportesTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Reportes" className="mb-6 flex gap-2 border-b border-border">
      {PESTANAS.map((p) => {
        const activa = p.exacta ? pathname === p.href : pathname.startsWith(p.href);
        return (
          <Link
            key={p.href}
            href={p.href}
            aria-current={activa ? "page" : undefined}
            className={`-mb-px border-b-2 px-4 py-2 text-sm transition-colors ${
              activa
                ? "border-primary font-semibold text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {p.etiqueta}
          </Link>
        );
      })}
    </nav>
  );
}
