import type { Metadata } from "next";
import { CalendarDays, CircleUserRound } from "lucide-react";
import { SiteHeader } from "@/components/cinema/SiteHeader";

export const metadata: Metadata = {
  title: "Mi perfil | Órbita Cinema",
  description:
    "Administra tus datos personales y datos de facturación en tu perfil de Órbita Cinema.",
  openGraph: {
    title: "Mi perfil | Órbita Cinema",
    description: "Datos personales y de facturación.",
  },
};

const NAV = ["Mi perfil", "Historial de compra", "Puntos de lealtad", "Soporte al cliente"];

export default function PerfilPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto grid max-w-[1400px] gap-8 px-6 py-8 lg:grid-cols-[280px_1fr]">
        <aside className="card-surface h-fit overflow-hidden">
          <h2 className="border-b border-border px-5 py-4 text-2xl tracking-wide">
            Navegación
          </h2>
          <ul>
            {NAV.map((item, i) => (
              <li key={item}>
                <button
                  className={`w-full border-l-4 px-5 py-3.5 text-left text-sm transition-colors ${
                    i === 0
                      ? "border-primary bg-surface-2 font-semibold text-primary"
                      : "border-transparent text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                  }`}
                >
                  {item}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section className="card-surface overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <h1 className="text-3xl tracking-wide">Perfil</h1>
            <span className="flex items-center gap-2 text-sm text-secondary">
              <CircleUserRound className="h-6 w-6" /> Usuario
            </span>
          </div>

          <div className="grid gap-8 p-6 md:grid-cols-2 md:divide-x md:divide-border">
            <div className="space-y-4 md:pr-8">
              <h2 className="section-title">Datos Personales</h2>
              <div>
                <label className="label">Nombre</label>
                <input className="field" defaultValue="Ana" />
              </div>
              <div>
                <label className="label">Apellido</label>
                <input className="field" defaultValue="Icú" />
              </div>
              <div>
                <label className="label">Correo Electrónico</label>
                <input className="field" defaultValue="ana.icu@correo.com" />
              </div>
              <div>
                <label className="label">Fecha de cumpleaños</label>
                <div className="flex items-center gap-3">
                  <input className="field" defaultValue="14 / 03 / 1999" />
                  <CalendarDays className="h-5 w-5 shrink-0 text-primary" />
                </div>
              </div>
              <div className="flex flex-wrap gap-3 pt-2">
                <button className="btn-ghost">Cambiar contraseña</button>
                <button className="btn-primary">Guardar cambios</button>
              </div>
            </div>

            <div className="space-y-4 md:pl-8">
              <h2 className="section-title">Datos de Facturación</h2>
              <div>
                <label className="label">Factura</label>
                <select className="field" defaultValue="C/F">
                  <option>Elija una opción</option>
                  <option>C/F</option>
                  <option>NIT</option>
                </select>
              </div>
              <div>
                <label className="label">Nombre</label>
                <input className="field" defaultValue="Ana Icú" />
              </div>
              <div>
                <label className="label">Nit</label>
                <input className="field" defaultValue="C/F" />
              </div>
              <div>
                <label className="label">Dirección</label>
                <input className="field" defaultValue="Ciudad de Guatemala" />
              </div>
              <div className="flex justify-end pt-2">
                <button className="btn-primary">Guardar</button>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
