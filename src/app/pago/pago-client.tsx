"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckCircle2, X } from "lucide-react";
import { SiteHeader } from "@/components/cinema/SiteHeader";
import { FunctionHeader } from "@/components/cinema/FunctionHeader";
import { Modal } from "@/components/cinema/Modal";
import { buildFunctionLabel, getMovie } from "@/lib/cinema-data";

type Props = {
  slug: string;
  hall: string;
  time: string;
  format: string;
  seats: string;
  total: number;
};

export function PagoClient(search: Props) {
  const movie = getMovie(search.slug || "batman");
  const [done, setDone] = useState(false);
  const [factura, setFactura] = useState("C/F");
  const [showMember, setShowMember] = useState(true);

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-[1400px] px-6 py-10">
        <FunctionHeader
          title={movie.title}
          subtitle={buildFunctionLabel(search.hall, search.time, search.format)}
        />

        <section
          className={`card-surface p-8 transition-all ${
            showMember ? "pointer-events-none select-none blur-sm" : ""
          }`}
          aria-hidden={showMember}
        >
          <div className="grid gap-8 lg:grid-cols-3">
            <div className="space-y-4">
              <h2 className="section-title">Datos Personales</h2>
              <div>
                <label className="label">Nombre</label>
                <input className="field" placeholder="Nombre" />
              </div>
              <div>
                <label className="label">Apellido</label>
                <input className="field" placeholder="Apellido" />
              </div>
              <div>
                <label className="label">Correo Electrónico</label>
                <input className="field" placeholder="correo@ejemplo.com" />
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="section-title">Datos de Facturación</h2>
              <div>
                <label className="label">Factura</label>
                <select
                  className="field"
                  value={factura}
                  onChange={(e) => setFactura(e.target.value)}
                >
                  <option>Elija una opción</option>
                  <option>C/F</option>
                  <option>NIT</option>
                </select>
              </div>
              <div>
                <label className="label">Nombre</label>
                <input className="field" placeholder="Nombre en factura" />
              </div>
              <div>
                <label className="label">Nit</label>
                <input className="field" placeholder="C/F" />
              </div>
              <div>
                <label className="label">Dirección</label>
                <input className="field" placeholder="Dirección" />
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="section-title">Pago</h2>
              <div>
                <label className="label">No. de Tarjeta</label>
                <input className="field" placeholder="0000 0000 0000 0000" />
              </div>
              <div>
                <label className="label">Nombre</label>
                <input className="field" placeholder="Nombre en la tarjeta" />
              </div>
              <div>
                <label className="label">Vencimiento</label>
                <div className="flex items-center gap-2">
                  <input className="field" placeholder="MM" />
                  <span className="text-muted-foreground">/</span>
                  <input className="field" placeholder="AA" />
                </div>
              </div>
              <div>
                <label className="label">CVV</label>
                <input className="field" placeholder="123" />
              </div>
            </div>
          </div>

          <label className="mt-6 flex items-start gap-3 text-sm text-muted-foreground">
            <input
              type="checkbox"
              defaultChecked
              className="mt-0.5 h-4 w-4 accent-[var(--primary)]"
            />
            He leído y estoy de acuerdo con los Términos y Condiciones y Aviso de Privacidad
          </label>

          <div className="mt-6 flex justify-end">
            <button className="btn-primary px-12" onClick={() => setDone(true)}>
              Pagar
            </button>
          </div>
        </section>
      </main>

      {showMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="card-surface w-full max-w-md p-6">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-2xl tracking-wide">¿Ya eres miembro?</h2>
                <p className="mt-1 text-sm text-muted-foreground">Elija una opción</p>
              </div>
              <button
                onClick={() => setShowMember(false)}
                aria-label="Cerrar"
                className="rounded-md p-1 text-muted-foreground transition-colors hover:text-primary"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label className="label">Email:</label>
                <input className="field" placeholder="correo@ejemplo.com" />
              </div>
              <div>
                <label className="label">Password:</label>
                <input type="password" className="field" placeholder="••••••••" />
              </div>
              <label className="flex items-center gap-2 text-sm text-muted-foreground">
                <input
                  type="checkbox"
                  defaultChecked
                  className="h-4 w-4 accent-[var(--primary)]"
                />
                Remember Me
              </label>
              <div className="flex items-center justify-between">
                <button className="btn-primary" onClick={() => setShowMember(false)}>
                  Login
                </button>
                <a href="#" className="text-sm text-muted-foreground hover:text-primary">
                  Forgot password?
                </a>
              </div>
              <div className="h-px bg-border" />
              <button className="btn-ghost w-full" onClick={() => setShowMember(false)}>
                Continuar como invitado
              </button>
              <button className="btn-light w-full" onClick={() => setShowMember(false)}>
                Registrarse
              </button>
            </div>
          </div>
        </div>
      )}

      <Modal
        open={done}
        title="Compra confirmada"
        onClose={() => setDone(false)}
        footer={
          <Link href="/" className="btn-primary" onClick={() => setDone(false)}>
            Volver a cartelera
          </Link>
        }
      >
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <CheckCircle2 className="h-14 w-14 text-primary" />
          <p className="text-lg font-semibold">¡Gracias por tu compra!</p>
          <p className="text-sm text-muted-foreground">
            {movie.title} · {search.hall || "Sala 1 Regular 2D"} ·{" "}
            {search.time || "18:00"} Hrs. · Asientos{" "}
            {search.seats ? search.seats.split(",").join(", ") : "—"}
          </p>
          <p className="text-sm text-muted-foreground">
            Total pagado:{" "}
            <span className="font-bold text-primary">
              Q.{(search.total || 94.5).toFixed(2)}
            </span>
          </p>
        </div>
      </Modal>
    </div>
  );
}
