import Link from "next/link";
import {
  ArrowLeft,
  ScanLine,
  Users,
} from "lucide-react";

type RutaEntradas =
  | "entradas"
  | "asistentes"
  | "validar"
  | "detalle";

const enlaces: {
  id: Exclude<RutaEntradas, null>;
  href: string;
  etiqueta: string;
  icono?: typeof Users;
}[] = [
  {
    id: "entradas",
    href: "/admin/entradas",
    etiqueta: "Entradas",
  },
  {
    id: "asistentes",
    href: "/admin/entradas/asistentes",
    etiqueta: "Personas por función",
    icono: Users,
  },
  {
    id: "validar",
    href: "/admin/entradas/validar",
    etiqueta: "Validar entrada",
    icono: ScanLine,
  },
];

export function EntradasNav({
  actual,
}: {
  actual: RutaEntradas;
}) {
  return (
    <nav
      aria-label="Navegación de Entradas"
      className="flex flex-wrap gap-3"
    >
      {enlaces.map((enlace) => {
        const Icono = enlace.icono;
        const activo = actual === enlace.id;
        const contenido = (
          <>
            {actual === "detalle" && enlace.id === "entradas" ? (
              <ArrowLeft className="h-4 w-4" />
            ) : Icono ? (
              <Icono className="h-4 w-4" />
            ) : null}
            {actual === "detalle" && enlace.id === "entradas"
              ? "Volver a Entradas"
              : enlace.etiqueta}
          </>
        );

        return activo ? (
          <span
            key={enlace.id}
            aria-current="page"
            className="btn-primary inline-flex w-fit cursor-default items-center gap-2"
          >
            {contenido}
          </span>
        ) : (
          <Link
            key={enlace.id}
            href={enlace.href}
            className="btn-ghost inline-flex w-fit items-center gap-2"
          >
            {contenido}
          </Link>
        );
      })}
    </nav>
  );
}
