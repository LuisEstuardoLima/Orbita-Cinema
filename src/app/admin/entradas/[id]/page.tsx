/**
 * Detalle administrativo de una reserva — `/admin/entradas/[id]` (SCRUM-135).
 *
 * Vista de solo lectura para Colaborador y Administrador.
 * No modifica la reserva ni las entradas.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ScanLine, TicketCheck } from "lucide-react";
import { notFound } from "next/navigation";

import { exigirRol } from "@/lib/auth/pagina";
import { numeroReserva, quetzales } from "@/lib/compra";
import {
  obtenerDetalleEntradaAdmin,
  type EstadoEntradaAdmin,
} from "@/lib/db/entradas";
import { ROLES_PANEL } from "@/lib/permisos";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Detalle de reserva | Órbita Cinema",
  description:
    "Detalle administrativo de una reserva y sus entradas.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await exigirRol(
    ROLES_PANEL,
    "/admin/entradas",
  );

  const { id } = await params;
  const idReserva = Number(id);

  if (
    !Number.isInteger(idReserva) ||
    idReserva <= 0
  ) {
    notFound();
  }

  let detalle;

  try {
    detalle =
      await obtenerDetalleEntradaAdmin(
        idReserva,
      );
  } catch {
    return (
      <div className="space-y-6">
        <Encabezado />

        <div
          role="alert"
          className="card-surface border-destructive/50 bg-destructive/10 p-6 text-sm text-destructive"
        >
          No se pudo consultar el detalle de la reserva.
          Intenta nuevamente.
        </div>
      </div>
    );
  }

  if (!detalle) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <Encabezado />

      <section className="card-surface p-6">
        <div className="flex flex-col justify-between gap-4 border-b border-border pb-6 md:flex-row md:items-start">
          <div>
            <p className="text-sm text-muted-foreground">
              Número de reserva
            </p>

            <h1 className="mt-1 text-3xl tracking-wide text-primary">
              {numeroReserva(
                detalle.idReserva,
              )}
            </h1>

            <p className="mt-2 text-sm text-muted-foreground">
              Reserva registrada el{" "}
              {formatearFechaHora(
                detalle.fechaReserva,
              )}
            </p>
          </div>

          <EstadoBadge
            estado={detalle.estado}
          />
        </div>

        <div className="grid gap-8 py-6 lg:grid-cols-3">
          <div className="space-y-3">
            <h2 className="section-title">
              Cliente
            </h2>

            <Dato
              etiqueta="Nombre"
              valor={detalle.nombreComprador}
            />

            <Dato
              etiqueta="Correo"
              valor={detalle.correoComprador}
            />

            <Dato
              etiqueta="Teléfono"
              valor={
                detalle.telefonoComprador ||
                "—"
              }
            />
          </div>

          <div className="space-y-3">
            <h2 className="section-title">
              Función
            </h2>

            <Dato
              etiqueta="Película"
              valor={
                detalle.funcion.pelicula
              }
            />

            <Dato
              etiqueta="Fecha"
              valor={formatearFecha(
                detalle.funcion.fecha,
              )}
            />

            <Dato
              etiqueta="Hora"
              valor={
                detalle.funcion.hora
                  ? `${detalle.funcion.hora} Hrs.`
                  : "—"
              }
            />

            <Dato
              etiqueta="Sala"
              valor={detalle.funcion.sala}
            />
          </div>

          <div className="space-y-3">
            <h2 className="section-title">
              Reserva
            </h2>

            <Dato
              etiqueta="Cantidad de asientos"
              valor={String(
                detalle.entradas.length,
              )}
            />

            <Dato
              etiqueta="Total"
              valor={quetzales(
                detalle.total,
              )}
            />

            <Dato
              etiqueta="ID de boleto"
              valor={String(
                detalle.idBoleto,
              )}
            />

            <Dato
              etiqueta="Fecha de uso"
              valor={
                detalle.fechaUso
                  ? formatearFechaHora(
                      detalle.fechaUso,
                    )
                  : "No utilizada"
              }
            />
          </div>
        </div>
      </section>

      <section className="card-surface">
        <div className="flex items-center justify-between gap-3 border-b border-border p-6">
          <div>
            <h2 className="text-2xl tracking-wide">
              Entradas asociadas
            </h2>

            <p className="mt-1 text-sm text-muted-foreground">
              Asientos y tipos de entrada
              registrados en esta reserva.
            </p>
          </div>

          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-2 px-3 py-1 text-sm text-muted-foreground">
            <TicketCheck className="h-4 w-4" />
            {detalle.entradas.length}{" "}
            {detalle.entradas.length === 1
              ? "entrada"
              : "entradas"}
          </span>
        </div>

        {detalle.entradas.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">
            Esta reserva no tiene entradas asociadas.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-surface-2 text-left uppercase tracking-wider text-muted-foreground">
                  <th className="px-5 py-3">
                    Asiento
                  </th>

                  <th className="px-5 py-3">
                    Tipo de entrada
                  </th>

                  <th className="px-5 py-3">
                    Precio
                  </th>

                  <th className="px-5 py-3">
                    Estado
                  </th>
                </tr>
              </thead>

              <tbody>
                {detalle.entradas.map(
                  (entrada) => (
                    <tr
                      key={
                        entrada.idDetalle
                      }
                      className="border-b border-border last:border-b-0"
                    >
                      <td className="px-5 py-4 font-semibold">
                        {entrada.asiento}
                      </td>

                      <td className="px-5 py-4 capitalize">
                        {formatearTipoEntrada(
                          entrada.tipoEntrada,
                        )}
                      </td>

                      <td className="px-5 py-4">
                        {quetzales(
                          entrada.precio,
                        )}
                      </td>

                      <td className="px-5 py-4">
                        <EstadoBadge
                          estado={
                            detalle.estado
                          }
                        />
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/admin/entradas"
          className="btn-ghost inline-flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver al listado
        </Link>

        <Link
          href={`/admin/entradas/validar`}
          className="btn-primary inline-flex items-center gap-2"
        >
          <ScanLine className="h-4 w-4" />
          Ir a validar entrada
        </Link>
      </div>

      <p className="text-xs text-muted-foreground">
        Esta pantalla es únicamente de consulta.
        La validación y el cambio de estado de las
        entradas se realizan desde el módulo de
        validación.
      </p>
    </div>
  );
}

function Encabezado() {
  return (
    <header>
      <h1 className="text-3xl tracking-wide">
        Detalle de reserva
      </h1>

      <p className="mt-1 text-sm text-muted-foreground">
        Consulta la información registrada de la
        compra y sus entradas asociadas.
      </p>
    </header>
  );
}

function Dato({
  etiqueta,
  valor,
}: {
  etiqueta: string;
  valor: string;
}) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">
        {etiqueta}
      </p>

      <p className="mt-1 font-medium">
        {valor}
      </p>
    </div>
  );
}

function EstadoBadge({
  estado,
}: {
  estado: EstadoEntradaAdmin;
}) {
  const estilos: Record<
    EstadoEntradaAdmin,
    string
  > = {
    Vigente:
      "border-emerald-500/40 bg-emerald-500/10 text-emerald-500",
    Cancelada:
      "border-destructive/40 bg-destructive/10 text-destructive",
    Utilizada:
      "border-secondary/40 bg-secondary/10 text-secondary",
  };

  return (
    <span
      className={`inline-flex w-fit rounded-full border px-2.5 py-1 text-xs font-semibold ${estilos[estado]}`}
    >
      {estado}
    </span>
  );
}

function formatearFecha(
  fecha: string | null,
): string {
  if (!fecha) {
    return "—";
  }

  const partes = fecha.split("-");

  if (partes.length !== 3) {
    return fecha;
  }

  const [anio, mes, dia] = partes;

  return `${dia}/${mes}/${anio}`;
}

function formatearFechaHora(
  fecha: string,
): string {
  const date = new Date(fecha);

  if (
    Number.isNaN(date.getTime())
  ) {
    return fecha;
  }

  return new Intl.DateTimeFormat(
    "es-GT",
    {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "America/Guatemala",
    },
  ).format(date);
}

function formatearTipoEntrada(
  tipo: string,
): string {
  if (tipo === "nino") {
    return "Niño";
  }

  if (tipo === "tercera_edad") {
    return "Tercera edad";
  }

  if (tipo === "adulto") {
    return "Adulto";
  }

  return tipo.replaceAll("_", " ");
}