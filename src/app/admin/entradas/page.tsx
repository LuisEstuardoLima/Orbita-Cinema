/**
 * Consulta administrativa de entradas — `/admin/entradas` (SCRUM-135).
 *
 * Colaborador y Administrador pueden consultar las entradas vendidas,
 * buscar por número de reserva o nombre del cliente y abrir el detalle.
 *
 * Esta pantalla es exclusivamente de consulta:
 * no modifica reservas, boletos ni estados de entradas.
 * La validación corresponde a `/admin/entradas/validar`.
 */

import type { Metadata } from "next";
import Link from "next/link";
import {
  Eye,
  ScanLine,
  Search,
  TicketCheck,
} from "lucide-react";

import { exigirRol } from "@/lib/auth/pagina";
import { numeroReserva } from "@/lib/compra";
import {
  listarEntradasAdmin,
  type EstadoEntradaAdmin,
  type FilaEntradaAdmin,
} from "@/lib/db/entradas";
import { ROLES_PANEL } from "@/lib/permisos";
import type { SP } from "@/lib/search-params";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Entradas vendidas | Órbita Cinema",
  description:
    "Consulta administrativa de reservas y entradas vendidas de Órbita Cinema.",
  robots: {
    index: false,
    follow: false,
  },
  openGraph: {
    title: "Entradas vendidas | Órbita Cinema",
    description:
      "Consulta de reservas y entradas vendidas.",
  },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  await exigirRol(
    ROLES_PANEL,
    "/admin/entradas",
  );

  const sp = await searchParams;

  const valorBusqueda = obtenerParametro(
    sp.buscar,
  );

  let entradas: FilaEntradaAdmin[] = [];
  let errorConsulta: string | null = null;

  try {
    entradas = await listarEntradasAdmin(
      valorBusqueda,
    );
  } catch {
    errorConsulta =
      "No se pudo consultar el listado de entradas. Intenta de nuevo.";
  }

  const buscando =
    valorBusqueda.trim().length > 0;

  const sinResultados =
    !errorConsulta &&
    entradas.length === 0;

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
        <div>
          <h1 className="text-3xl tracking-wide">
            Entradas
          </h1>

          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Consulta las reservas y entradas vendidas.
            Puedes buscar por número de reserva o
            por nombre del cliente.
          </p>
        </div>

        <Link
          href="/admin/entradas/validar"
          className="btn-primary inline-flex w-fit items-center gap-2"
        >
          <ScanLine className="h-4 w-4" />
          Validar entrada
        </Link>
      </header>

      <form
        method="get"
        className="card-surface p-6"
      >
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
          <div className="flex-1">
            <label
              htmlFor="buscar"
              className="label"
            >
              Buscar reserva o cliente
            </label>

            <div className="relative mt-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

              <input
                id="buscar"
                name="buscar"
                type="search"
                className="field pl-10"
                defaultValue={valorBusqueda}
                placeholder="Ej. ORB-000123, 123 o Ana López"
                autoComplete="off"
              />
            </div>

            <p className="mt-1 text-xs text-muted-foreground">
              Puedes escribir el número de reserva
              completo o una parte del nombre del
              comprador.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              className="btn-primary"
            >
              Buscar
            </button>

            {buscando && (
              <Link
                href="/admin/entradas"
                className="btn-ghost"
              >
                Limpiar
              </Link>
            )}
          </div>
        </div>
      </form>

      <section className="card-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-6">
          <div>
            <h2 className="text-2xl tracking-wide">
              Entradas vendidas
            </h2>

            <p className="mt-1 text-sm text-muted-foreground">
              {buscando
                ? `Resultados para “${valorBusqueda}”.`
                : "Listado general de reservas con boleto generado."}
            </p>
          </div>

          {!errorConsulta && (
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-2 px-3 py-1 text-sm text-muted-foreground">
              <TicketCheck className="h-4 w-4" />
              {entradas.length}{" "}
              {entradas.length === 1
                ? "reserva"
                : "reservas"}
            </span>
          )}
        </div>

        {errorConsulta && (
          <p
            role="alert"
            className="m-6 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {errorConsulta}
          </p>
        )}

        {sinResultados && (
          <div
            role="status"
            className="m-6 rounded-md border border-border bg-surface-2 px-4 py-6 text-center"
          >
            <p className="font-medium">
              No se encontraron resultados.
            </p>

            <p className="mt-1 text-sm text-muted-foreground">
              {buscando
                ? "Revisa el número de reserva o el nombre del cliente e intenta nuevamente."
                : "Todavía no hay entradas vendidas para mostrar."}
            </p>
          </div>
        )}

        {!errorConsulta &&
          entradas.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="bg-surface-2 text-left uppercase tracking-wider text-muted-foreground">
                    <th className="px-5 py-3">
                      Reserva
                    </th>

                    <th className="px-5 py-3">
                      Cliente
                    </th>

                    <th className="px-5 py-3">
                      Película
                    </th>

                    <th className="px-5 py-3">
                      Función
                    </th>

                    <th className="px-5 py-3">
                      Sala
                    </th>

                    <th className="px-5 py-3">
                      Asientos
                    </th>

                    <th className="px-5 py-3">
                      Estado
                    </th>

                    <th className="px-5 py-3 text-right">
                      Detalle
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {entradas.map((entrada) => (
                    <tr
                      key={entrada.idReserva}
                      className="border-b border-border transition-colors last:border-b-0 hover:bg-surface-2/60"
                    >
                      <td className="whitespace-nowrap px-5 py-4 font-semibold text-primary">
                        {numeroReserva(
                          entrada.idReserva,
                        )}
                      </td>

                      <td className="px-5 py-4">
                        {entrada.nombreComprador}
                      </td>

                      <td className="px-5 py-4">
                        {entrada.pelicula}
                      </td>

                      <td className="whitespace-nowrap px-5 py-4">
                        <p>
                          {formatearFecha(
                            entrada.fechaFuncion,
                          )}
                        </p>

                        <p className="text-xs text-muted-foreground">
                          {entrada.horaFuncion
                            ? `${entrada.horaFuncion} Hrs.`
                            : "Hora no disponible"}
                        </p>
                      </td>

                      <td className="whitespace-nowrap px-5 py-4">
                        {entrada.sala}
                      </td>

                      <td className="px-5 py-4">
                        <div className="min-w-32">
                          <p>
                            {entrada.asientos.length >
                            0
                              ? entrada.asientos.join(
                                  ", ",
                                )
                              : "—"}
                          </p>

                          <p className="mt-1 text-xs text-muted-foreground">
                            {entrada.cantidadAsientos}{" "}
                            {entrada.cantidadAsientos ===
                            1
                              ? "asiento"
                              : "asientos"}
                          </p>
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <EstadoBadge
                          estado={entrada.estado}
                        />
                      </td>

                      <td className="px-5 py-4 text-right">
                        <Link
                          href={`/admin/entradas/${entrada.idReserva}`}
                          className="btn-ghost inline-flex items-center gap-2 whitespace-nowrap"
                        >
                          <Eye className="h-4 w-4" />
                          Ver detalle
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </section>

      <p className="text-xs text-muted-foreground">
        Este módulo es únicamente de consulta. La
        validación de entradas y el cambio de estado
        se realizan desde la opción “Validar entrada”.
      </p>
    </div>
  );
}

function obtenerParametro(
  valor: SP[string],
): string {
  if (Array.isArray(valor)) {
    return valor[0] ?? "";
  }

  return valor ?? "";
}

function formatearFecha(
  fecha: string | null,
): string {
  if (!fecha) {
    return "Fecha no disponible";
  }

  const partes = fecha.split("-");

  if (partes.length !== 3) {
    return fecha;
  }

  const [anio, mes, dia] = partes;

  return `${dia}/${mes}/${anio}`;
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
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${estilos[estado]}`}
    >
      {estado}
    </span>
  );
}