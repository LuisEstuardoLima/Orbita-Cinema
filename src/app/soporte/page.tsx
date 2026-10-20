import type { Metadata } from "next";
import { Mail } from "lucide-react";

import { SiteHeader } from "@/components/cinema/SiteHeader";
import { SiteFooter } from "@/components/cinema/SiteFooter";
import {
  CORREO_SOPORTE,
  MAILTO_SOPORTE,
} from "@/lib/soporte";

export const metadata: Metadata = {
  title: "Soporte al cliente | Órbita Cinema",
  description:
    "Consulta la información oficial de contacto y soporte de Órbita Cinema.",
  openGraph: {
    title: "Soporte al cliente | Órbita Cinema",
    description:
      "Información oficial de contacto y soporte de Órbita Cinema.",
  },
};

export default function SoportePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <section className="card-surface w-full max-w-2xl rounded-xl p-8 text-center md:p-10">
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Mail className="h-7 w-7" />
          </div>

          <h1 className="text-3xl tracking-wide">
            Soporte al cliente
          </h1>

          <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
            Si necesitas ayuda o tienes alguna consulta sobre Órbita Cinema,
            puedes comunicarte con nuestro equipo mediante correo electrónico.
          </p>

          <div className="mt-8 rounded-lg border border-border bg-surface-2 p-6">
            <p className="text-sm text-muted-foreground">
              Correo electrónico de soporte
            </p>

            <a
              href={MAILTO_SOPORTE}
              className="mt-2 inline-block break-all text-lg font-semibold text-primary transition-colors hover:underline"
            >
              {CORREO_SOPORTE}
            </a>
          </div>

          <p className="mt-6 text-sm text-muted-foreground">
            Al seleccionar la dirección se abrirá la aplicación de correo
            predeterminada de tu dispositivo. Órbita Cinema no envía ni
            almacena consultas desde esta página.
          </p>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}