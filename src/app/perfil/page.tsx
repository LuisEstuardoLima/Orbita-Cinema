import type { Metadata } from "next";
import Link from "next/link";
import {
  CalendarDays,
  CircleUserRound,
  Info,
} from "lucide-react";

import { SiteHeader } from "@/components/cinema/SiteHeader";
import { SiteFooter } from "@/components/cinema/SiteFooter";
import { obtenerMisReservas } from "./actions";
import type { ReservaHistorial } from "./actions";
import { CancelarReservaModal } from "./CancelarReservaModal";
import { quetzales } from "@/lib/compra";

export const metadata: Metadata = {
  title: "Mi perfil | Órbita Cinema",
  description:
    "Administra tus datos personales y datos de facturación en tu perfil de Órbita Cinema.",
  openGraph: {
    title: "Mi perfil | Órbita Cinema",
    description: "Datos personales y de facturación.",
  },
};

type Seccion = "perfil" | "historial";

const NAV = [
  { label: "Mi perfil", href: "/perfil", seccion: "perfil" as Seccion },
  {
    label: "Historial de compra",
    href: "/perfil?seccion=historial",
    seccion: "historial" as Seccion,
  },
  { label: "Puntos de lealtad", href: "#", seccion: null },
  { label: "Soporte al cliente", href: "/soporte", seccion: null },
];

function fechaGuatemala(fecha: string): string {
  if (!fecha) return "Fecha no disponible";
  const parsed = new Date(`${fecha.slice(0, 10)}T12:00:00-06:00`);
  if (Number.isNaN(parsed.getTime())) return fecha;
  return new Intl.DateTimeFormat("es-GT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "America/Guatemala",
  }).format(parsed);
}

function horaLegible(hora: string): string {
  if (!hora) return "Hora no disponible";
  const match = hora.match(/^(\d{1,2}):(\d{2})/);
  if (!match || !match[1] || !match[2]) return hora;
  const date = new Date(
    `1970-01-01T${match[1].padStart(2, "0")}:${match[2]}:00-06:00`,
  );
  return new Intl.DateTimeFormat("es-GT", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/Guatemala",
  }).format(date);
}

function funcionYaPaso(fecha: string, hora: string): boolean {
  if (!fecha || !hora) return true;
  const horaMatch = hora.match(/^(\d{1,2}):(\d{2})/);
  if (!horaMatch || !horaMatch[1] || !horaMatch[2]) return true;

  // Las fechas/horas de funciones se interpretan en la zona horaria de Guatemala.
  const inicio = new Date(
    `${fecha.slice(0, 10)}T${horaMatch[1].padStart(2, "0")}:${horaMatch[2]}:00-06:00`,
  );
  if (Number.isNaN(inicio.getTime())) return true;
  return inicio.getTime() <= Date.now();
}

function estadoLegible(estado: string): string {
  const estados: Record<string, string> = {
    confirmada: "Confirmada",
    cancelada_cliente: "Cancelada",
    cancelada: "Cancelada",
    pendiente_pago: "Pendiente de pago",
    expirada: "Expirada",
    usada: "Usada",
    utilizada: "Usada",
    completada: "Completada",
  };
  return estados[estado] ?? estado.replaceAll("_", " ");
}

function ReservaCard({ reserva }: { reserva: ReservaHistorial }) {
  const funcionPasada = funcionYaPaso(reserva.fecha_funcion, reserva.hora_funcion);
  const estadoNoCancelable = reserva.estado !== "confirmada";
  const puedeCancelar = !funcionPasada && !estadoNoCancelable;
  const estadoVisual =
    reserva.estado === "confirmada" && funcionPasada
      ? "Función finalizada"
      : estadoLegible(reserva.estado);

  const estadoClases =
    reserva.estado === "cancelada_cliente" || reserva.estado === "cancelada"
      ? "border-rose-400/30 bg-rose-950/30 text-rose-300"
      : reserva.estado === "confirmada" && !funcionPasada
        ? "border-emerald-400/30 bg-emerald-950/30 text-emerald-300"
        : funcionPasada
          ? "border-slate-500/40 bg-slate-800 text-slate-300"
          : "border-amber-400/30 bg-amber-950/30 text-amber-300";

  return (
    <article className="overflow-hidden rounded-2xl border border-[#484848] bg-[#303030] shadow-sm transition-shadow hover:shadow-md">
      <div className="h-1.5 bg-orange-500" />
      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-400">
              Reserva ORB-{String(reserva.id_reserva).padStart(6, "0")}
            </p>
            <h3 className="mt-1 text-xl font-bold text-[#f3f3f3]">
              {reserva.pelicula || "Película no disponible"}
            </h3>
            <p className="mt-1 text-sm text-[#b0b0b0]">{reserva.sala || "Sala no disponible"}</p>
          </div>
          <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${estadoClases}`}>
            {estadoVisual}
          </span>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-[#3a3a3a] p-3">
            <p className="text-xs font-medium text-[#b0b0b0]">Fecha y hora</p>
            <p className="mt-1 font-semibold text-[#eeeeee]">
              {fechaGuatemala(reserva.fecha_funcion)}
            </p>
            <p className="text-sm text-[#c5c5c5]">{horaLegible(reserva.hora_funcion)}</p>
          </div>
          <div className="rounded-xl bg-[#38332f] p-3">
            <p className="text-xs font-medium text-[#b0b0b0]">Total de compra</p>
            <p className="mt-1 text-lg font-bold text-orange-200">{quetzales(reserva.total)}</p>
            <p className="text-sm text-orange-300">{reserva.puntos_ganados} puntos ganados por compra</p>
          </div>
        </div>

        {puedeCancelar ? (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#505050] pt-4">
            <p className="max-w-md text-xs leading-relaxed text-[#b0b0b0]">
              Puedes cancelar hasta 30 minutos antes de que comience la función. El reembolso se acredita en puntos.
            </p>
            <CancelarReservaModal
              reserva={{
                id_reserva: reserva.id_reserva,
                pelicula: reserva.pelicula,
                sala: reserva.sala,
                fecha_funcion: reserva.fecha_funcion,
                hora_funcion: reserva.hora_funcion,
                total: reserva.total,
                estado: reserva.estado,
              }}
            />
          </div>
        ) : (
          <div className="mt-5 flex items-start gap-2 rounded-xl bg-[#383838] px-3 py-3 text-sm text-[#c5c5c5]">
            <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-orange-400" />
            <p>
              {funcionPasada
                ? "La función ya comenzó o finalizó; la cancelación ya no está disponible."
                : reserva.estado === "cancelada_cliente" || reserva.estado === "cancelada"
                  ? "Esta reserva ya fue cancelada."
                  : reserva.estado === "usada" || reserva.estado === "utilizada"
                    ? "Esta entrada ya fue utilizada."
                    : `Esta reserva no se puede cancelar en su estado actual (${estadoLegible(reserva.estado)}).`}
            </p>
          </div>
        )}
      </div>
    </article>
  );
}

export default async function PerfilPage({
  searchParams,
}: {
  searchParams: Promise<{ seccion?: string }>;
}) {
  const params = await searchParams;
  const seccionActiva: Seccion = params.seccion === "historial" ? "historial" : "perfil";

  let reservas: ReservaHistorial[] = [];
  let errorReservas: string | null = null;

  if (seccionActiva === "historial") {
    try {
      const resultado = await obtenerMisReservas();
      reservas = resultado.reservas;
      errorReservas = resultado.error;
    } catch {
      errorReservas = "No fue posible cargar tus reservas. Inténtalo de nuevo.";
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="mx-auto grid w-full max-w-[1400px] flex-1 gap-8 px-6 py-8 lg:grid-cols-[280px_1fr]">
        <aside className="card-surface h-fit overflow-hidden">
          <h2 className="border-b border-border px-5 py-4 text-2xl tracking-wide">
            Navegación
          </h2>
          <ul>
            {NAV.map((item) => (
              <li key={item.label}>
                {item.href === "#" ? (
                  <button
                    type="button"
                    disabled
                    className="w-full cursor-not-allowed border-l-4 border-transparent px-5 py-3.5 text-left text-sm text-muted-foreground opacity-70"
                  >
                    {item.label}
                  </button>
                ) : (
                  <Link
                    href={item.href}
                    aria-current={item.seccion === seccionActiva ? "page" : undefined}
                    className={`block w-full border-l-4 px-5 py-3.5 text-left text-sm transition-colors ${
                      item.seccion === seccionActiva
                        ? "border-primary bg-surface-2 font-semibold text-primary"
                        : "border-transparent text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                    }`}
                  >
                    {item.label}
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </aside>

        <section className="card-surface overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <h1 className="text-3xl tracking-wide">
              {seccionActiva === "historial" ? "Historial de compra" : "Perfil"}
            </h1>
            <span className="flex items-center gap-2 text-sm text-secondary">
              <CircleUserRound className="h-6 w-6" />
              Usuario
            </span>
          </div>

          {seccionActiva === "historial" ? (
            <div className="space-y-5 bg-gradient-to-b from-[#242424] via-[#2b2b2b] to-[#242424] p-5 sm:p-7">
              <div className="rounded-2xl border border-[#4a4a4a] border-t-2 border-t-orange-500 bg-[#343434] p-5 shadow-sm">
                <h2 className="text-2xl font-bold text-[#f3f3f3]">Tus reservas</h2>
                <p className="mt-2 text-sm text-[#c5c5c5]">
                  Revisa tus próximas funciones, compras anteriores y el estado de cada reserva.
                </p>
              </div>

              {errorReservas ? (
                <p role="alert" className="rounded-xl border border-rose-400/30 bg-rose-950/30 p-4 text-sm text-rose-300">
                  {errorReservas}
                </p>
              ) : reservas.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#666666] bg-[#303030] p-8 text-center shadow-sm">
                  <p className="font-medium">Todavía no tienes reservas.</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Cuando realices una compra, aparecerá aquí.
                  </p>
                  <Link href="/cartelera" className="btn-primary mt-4 inline-flex">
                    Ver cartelera
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {reservas.map((reserva) => (
                    <ReservaCard key={reserva.id_reserva} reserva={reserva} />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="grid gap-8 p-6 md:grid-cols-2 md:divide-x md:divide-border">
              <div className="space-y-4 md:pr-8">
                <h2 className="section-title">Datos Personales</h2>

                <div>
                  <label className="label" htmlFor="nombre">Nombre</label>
                  <input id="nombre" className="field" defaultValue="Ana" />
                </div>

                <div>
                  <label className="label" htmlFor="apellido">Apellido</label>
                  <input id="apellido" className="field" defaultValue="Icú" />
                </div>

                <div>
                  <label className="label" htmlFor="correo">Correo Electrónico</label>
                  <input id="correo" className="field" defaultValue="ana.icu@correo.com" />
                </div>

                <div>
                  <label className="label" htmlFor="cumpleanos">Fecha de cumpleaños</label>
                  <div className="flex items-center gap-3">
                    <input id="cumpleanos" className="field" defaultValue="14 / 03 / 1999" />
                    <CalendarDays className="h-5 w-5 shrink-0 text-primary" />
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 pt-2">
                  <button type="button" className="btn-ghost">Cambiar contraseña</button>
                  <button type="button" className="btn-primary">Guardar cambios</button>
                </div>
              </div>

              <div className="space-y-4 md:pl-8">
                <h2 className="section-title">Datos de Facturación</h2>

                <div>
                  <label className="label" htmlFor="tipo-factura">Factura</label>
                  <select id="tipo-factura" className="field" defaultValue="C/F">
                    <option value="">Elija una opción</option>
                    <option value="C/F">C/F</option>
                    <option value="NIT">NIT</option>
                  </select>
                </div>

                <div>
                  <label className="label" htmlFor="nombre-facturacion">Nombre</label>
                  <input id="nombre-facturacion" className="field" defaultValue="Ana Icú" />
                </div>

                <div>
                  <label className="label" htmlFor="nit">NIT</label>
                  <input id="nit" className="field" defaultValue="C/F" />
                </div>

                <div>
                  <label className="label" htmlFor="direccion">Dirección</label>
                  <input id="direccion" className="field" defaultValue="Ciudad de Guatemala" />
                </div>

                <div className="flex justify-end pt-2">
                  <button type="button" className="btn-primary">Guardar</button>
                </div>
              </div>
            </div>
          )}
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
