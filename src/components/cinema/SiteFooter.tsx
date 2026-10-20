import Link from "next/link";
import { Mail } from "lucide-react";
import {
  CORREO_SOPORTE,
  MAILTO_SOPORTE,
} from "@/lib/soporte";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border bg-surface">
      <div className="mx-auto flex max-w-[1400px] flex-col gap-4 px-6 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-medium text-foreground">
            ¿Necesitas ayuda?
          </p>

          <p className="mt-1">
            Escríbenos a{" "}
            <a
              href={MAILTO_SOPORTE}
              className="font-medium text-primary transition-colors hover:underline"
            >
              {CORREO_SOPORTE}
            </a>
          </p>
        </div>

        <Link
          href="/soporte"
          className="inline-flex items-center gap-2 font-medium text-secondary transition-colors hover:text-primary"
        >
          <Mail className="h-4 w-4" />
          Soporte al cliente
        </Link>
      </div>
    </footer>
  );
}