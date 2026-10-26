import type { Metadata } from "next";
import Link from "next/link";
import { CircleUserRound, Coins, Download, Info } from "lucide-react";
import { redirect } from "next/navigation";

import { SiteHeader } from "@/components/cinema/SiteHeader";
import { SiteFooter } from "@/components/cinema/SiteFooter";
import {
  obtenerMisReservas,
  obtenerMovimientosPuntos,
  type MovimientoPuntos,
  type ReservaHistorial,
} from "./actions";
import { CancelarReservaModal } from "./CancelarReservaModal";
import { PerfilForm } from "./PerfilForm";
import { getPerfilActual } from "@/lib/auth/perfil";
import { numeroReserva, quetzales } from "@/lib/compra";

export const metadata: Metadata = {
  title: "Mi perfil | Órbita Cinema",
  description: "Administra tus datos personales, reservas y puntos de lealtad.",
  openGraph: {
    title: "Mi perfil | Órbita Cinema",
    description: "Datos personales, historial de compras y puntos de lealtad.",
  },
};

type Seccion = "perfil" | "historial" | "puntos";

const NAV = [
  { label: "Mi perfil", href: "/perfil", seccion: "perfil" as Seccion },
  {
    label: "Historial de compra",
    href: "/perfil?seccion=historial",
    seccion: "historial" as Seccion,
  },
  {
    label: "Puntos de lealtad",
    href: "/perfil?seccion=puntos",
    seccion: "puntos" as Seccion,
  },
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
    confirmada: "Vigente",
    cancelada_cliente: "Cancelada",
    cancelada: "Cancelada",
    cancelada_funcion: "Cancelada",
    usada: "Usada",
    utilizada: "Usada",
    completada: "Usada",
  };
  return estados[estado] ?? estado.replaceAll("_", " ");
}

function movimientoLegible(tipo: string): string {
  const tipos: Record<string, string> = {
    compra: "Puntos por compra",
    reversion_compra: "Reversión de puntos por compra cancelada",
    reembolso_cancelacion: "Reembolso por cancelación",
    canje: "Canje de puntos",
  };
  return tipos[tipo] ?? tipo.replaceAll("_", " ");
}

function ReservaCard({ reserva }: { reserva: ReservaHistorial }) {
  const funcionPasada = funcionYaPaso(reserva.fecha_funcion, reserva.hora_funcion);
  const cancelada = ["cancelada_cliente", "cancelada", "cancelada_funcion"].includes(
    reserva.estado,
  );
  const usada = ["usada", "utilizada", "completada"].includes(reserva.estado);
  const puedeCancelar = !funcionPasada && reserva.estado === "confirmada";
  const puedeDescargarBoleto = [
    "confirmada",
    "usada",
    "utilizada",
    "completada",
  ].includes(reserva.estado);
  const estadoVisual = estadoLegible(reserva.estado);

  const estadoClases =
    cancelada
      ? "border-rose-400/30 bg-rose-950/30 text-rose-300"
      : reserva.estado === "confirmada"
        ? "border-emerald-400/30 bg-emerald-950/30 text-emerald-300"
        : usada
          ? "border-slate-500/40 bg-slate-800 text-slate-300"
          : "border-amber-400/30 bg-amber-950/30 text-amber-300";

  return (
    <article className="overflow-hidden rounded-2xl border border-[#484848] bg-[#303030] shadow-sm transition-shadow hover:shadow-md">
      <div className="h-1.5 bg-orange-500" />
      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-400">
              Reserva {numeroReserva(reserva.id_reserva)}
            </p>
            <h3 className="mt-1 text-xl font-bold text-[#f3f3f3]">
              {reserva.pelicula || "Película no disponible"}
            </h3>
          </div>
          <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${estadoClases}`}>
            {estadoVisual}
          </span>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl bg-[#3a3a3a] p-3">
            <p className="text-xs font-medium text-[#b0b0b0]">Fecha y hora</p>
            <p className="mt-1 font-semibold text-[#eeeeee]">
              {fechaGuatemala(reserva.fecha_funcion)}
            </p>
            <p className="text-sm text-[#c5c5c5]">{horaLegible(reserva.hora_funcion)}</p>
          </div>
          <div className="rounded-xl bg-[#3a3a3a] p-3">
            <p className="text-xs font-medium text-[#b0b0b0]">Sala</p>
            <p className="mt-1 font-semibold text-[#eeeeee]">
              {reserva.sala || "Sala no disponible"}
            </p>
          </div>
          <div className="rounded-xl bg-[#3a3a3a] p-3">
            <p className="text-xs font-medium text-[#b0b0b0]">Asientos</p>
            <p className="mt-1 font-semibold text-[#eeeeee]">
              {reserva.asientos.length > 0
                ? reserva.asientos.join(", ")
                : "Sin asientos registrados"}
            </p>
          </div>
          <div className="rounded-xl bg-[#38332f] p-3">
            <p className="text-xs font-medium text-[#b0b0b0]">Total de compra</p>
            <p className="mt-1 text-lg font-bold text-orange-200">{quetzales(reserva.total)}</p>
            <p className="text-sm text-orange-300">
              {reserva.puntos_ganados} puntos ganados por compra
            </p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#505050] pt-4">
          {puedeCancelar ? (
            <>
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
            </>
          ) : (
            <div className="flex items-start gap-2 text-sm text-[#c5c5c5]">
              <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-orange-400" />
              <p>
                {cancelada
                  ? "Esta reserva ya fue cancelada."
                  : usada
                    ? "Esta entrada ya fue utilizada."
                    : funcionPasada
                      ? "La función ya comenzó o finalizó; la cancelación ya no está disponible."
                      : `Esta reserva no se puede cancelar en su estado actual (${estadoVisual}).`}
              </p>
            </div>
          )}

          {puedeDescargarBoleto ? (
            <a
              href={`/perfil/boletos/${reserva.id_reserva}`}
              className="btn-ghost inline-flex items-center gap-2"
              aria-label={`Descargar boleto de ${numeroReserva(reserva.id_reserva)}`}
            >
              <Download aria-hidden="true" className="h-4 w-4" />
              Descargar boleto
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export default async function PerfilPage({
  searchParams,
}: {
  searchParams: Promise<{ seccion?: string }>;
}) {
  const [params, perfil] = await Promise.all([searchParams, getPerfilActual()]);
  if (!perfil) redirect("/login?next=%2Fperfil");

  const seccionActiva: Seccion =
    params.seccion === "historial"
      ? "historial"
      : params.seccion === "puntos"
        ? "puntos"
        : "perfil";

  let reservas: ReservaHistorial[] = [];
  let errorReservas: string | null = null;
  let movimientos: MovimientoPuntos[] = [];
  let saldoPuntos = 0;
  let errorPuntos: string | null = null;

  if (seccionActiva === "historial") {
    try {
      const resultado = await obtenerMisReservas();
      reservas = resultado.reservas;
      errorReservas = resultado.error;
    } catch (error) {
      console.error("[perfil] No se pudo cargar el historial de reservas:", error);
      errorReservas = "No fue posible cargar tus reservas. Inténtalo de nuevo.";
    }
  } else if (seccionActiva === "puntos") {
    try {
      const resultado = await obtenerMovimientosPuntos();
      movimientos = resultado.movimientos;
      saldoPuntos = resultado.saldo;
      errorPuntos = resultado.error;
    } catch (error) {
      console.error("[perfil] No se pudieron cargar los puntos de lealtad:", error);
      errorPuntos = "No fue posible cargar tus puntos. Inténtalo de nuevo.";
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
              </li>
            ))}
          </ul>
        </aside>

        <section className="card-surface overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <h1 className="text-3xl tracking-wide">
              {seccionActiva === "historial"
                ? "Historial de compra"
                : seccionActiva === "puntos"
                  ? "Puntos de lealtad"
                  : "Mi perfil"}
            </h1>
            <span className="flex items-center gap-2 text-sm text-secondary">
              <CircleUserRound className="h-6 w-6" />
              <span>{perfil.nombre || perfil.email}</span>
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
          ) : seccionActiva === "puntos" ? (
            <div className="space-y-5 bg-gradient-to-b from-[#242424] via-[#2b2b2b] to-[#242424] p-5 sm:p-7">
              {errorPuntos ? (
                <p role="alert" className="rounded-xl border border-rose-400/30 bg-rose-950/30 p-4 text-sm text-rose-300">
                  {errorPuntos}
                </p>
              ) : (
                <>
                  <div className="rounded-2xl border border-[#4a4a4a] border-t-2 border-t-orange-500 bg-[#343434] p-5 shadow-sm">
                    <div className="flex items-center gap-3">
                      <Coins aria-hidden="true" className="h-8 w-8 text-orange-400" />
                      <div>
                        <h2 className="text-2xl font-bold text-[#f3f3f3]">Tu saldo</h2>
                        <p className="mt-1 text-sm text-[#c5c5c5]">
                          1 punto equivale a Q1.
                        </p>
                      </div>
                    </div>
                    <div className="mt-5 flex flex-wrap items-end gap-x-8 gap-y-3">
                      <p className="text-3xl font-bold text-orange-300">
                        {saldoPuntos} <span className="text-lg font-medium">puntos</span>
                      </p>
                      <p className="text-lg font-semibold text-[#eeeeee]">
                        Equivalente: {quetzales(saldoPuntos)}
                      </p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[#4a4a4a] bg-[#343434] p-5">
                    <h2 className="text-xl font-bold text-[#f3f3f3]">Movimientos</h2>
                    {movimientos.length === 0 ? (
                      <p className="mt-3 rounded-xl border border-dashed border-[#666666] p-5 text-sm text-[#c5c5c5]">
                        Aún no tienes movimientos de puntos. Los puntos de tus compras y reembolsos aparecerán aquí.
                      </p>
                    ) : (
                      <ul className="mt-3 divide-y divide-[#505050]">
                        {movimientos.map((movimiento) => (
                          <MovimientoPuntosItem
                            key={movimiento.id_movimiento}
                            movimiento={movimiento}
                          />
                        ))}
                      </ul>
                    )}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="p-6">
              <div className="mx-auto max-w-2xl space-y-5">
                <div>
                  <h2 className="section-title">Datos personales</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Mantén actualizados los datos de tu cuenta.
                  </p>
                </div>
                <PerfilForm
                  nombre={perfil.nombre}
                  apellido={perfil.apellido}
                  telefono={perfil.telefono}
                  email={perfil.email}
                />
              </div>
            </div>
          )}
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

function MovimientoPuntosItem({
  movimiento,
}: {
  movimiento: MovimientoPuntos;
}) {
  const puntos = movimiento.puntos > 0 ? `+${movimiento.puntos}` : movimiento.puntos;

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 py-4">
      <div>
        <p className="font-semibold text-[#eeeeee]">
          {movimiento.descripcion || movimientoLegible(movimiento.tipo_movimiento)}
        </p>
        <p className="mt-1 text-sm text-[#b0b0b0]">
          {fechaGuatemala(movimiento.fecha_movimiento)}
          {" · "}
          {movimientoLegible(movimiento.tipo_movimiento)}
        </p>
        <Link
          href="/perfil?seccion=historial"
          className="mt-1 inline-block text-sm text-orange-300 hover:text-orange-200"
        >
          Reserva {numeroReserva(movimiento.id_reserva)}
        </Link>
      </div>
      <p className={`text-lg font-bold ${movimiento.puntos > 0 ? "text-emerald-300" : "text-rose-300"}`}>
        {puntos} {Math.abs(movimiento.puntos) === 1 ? "punto" : "puntos"}
      </p>
    </li>
  );
}
