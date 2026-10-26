/**
 * Personas con reserva por función y sala — `/admin/entradas/asistentes`
 * SCRUM-136.
 *
 * Colaborador y Administrador pueden seleccionar una función,
 * consultar sus asistentes, filtrar por ID de entrada, nombre o correo,
 * y conocer la ocupación de la sala.
 *
 * Esta funcionalidad es exclusivamente de consulta.
 * La validación y el cambio de estado corresponden a SCRUM-140.
 */

import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeft,
  Mail,
  Search,
  TicketCheck,
  Users,
} from "lucide-react";

import { exigirRol } from "@/lib/auth/pagina";
import { numeroReserva } from "@/lib/compra";
import {
  listarAsistentesFuncion,
  type AsistenteFuncion,
  type EstadoAsistente,
  type TipoBusquedaAsistente,
} from "@/lib/db/asistentes";
import {
  consultarOcupacionFuncion,
  listFuncionesOcupacion,
} from "@/lib/db/ocupacion";
import {
  etiquetaFuncionOpcion,
  type FuncionOpcion,
} from "@/lib/ocupacion";
import { ROLES_PANEL } from "@/lib/permisos";
import type { SP } from "@/lib/search-params";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title:
    "Personas por función y sala | Órbita Cinema",
  description:
    "Consulta administrativa de personas con reserva y ocupación por función.",
  robots: {
    index: false,
    follow: false,
  },
};

const TIPOS_BUSQUEDA: {
  id: TipoBusquedaAsistente;
  etiqueta: string;
  placeholder: string;
}[] = [
  {
    id: "entrada",
    etiqueta: "ID de entrada",
    placeholder: "Ej. 245",
  },
  {
    id: "nombre",
    etiqueta: "Nombre",
    placeholder: "Ej. Ana López",
  },
  {
    id: "correo",
    etiqueta: "Correo electrónico",
    placeholder: "Ej. ana@correo.com",
  },
];

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  await exigirRol(
    ROLES_PANEL,
    "/admin/entradas/asistentes",
  );

  const sp = await searchParams;

  const idFuncion = enteroPositivo(
    obtenerParametro(sp.funcion),
  );

  const tipo = tipoBusqueda(
    obtenerParametro(sp.tipo),
  );

  const busqueda = obtenerParametro(
    sp.buscar,
  ).trim();

  let funciones: FuncionOpcion[] = [];
  let truncado = false;
  let errorFunciones: string | null = null;

  try {
    const resultado =
      await listFuncionesOcupacion({
        desde: null,
        hasta: null,
        idPelicula: null,
        idSala: null,
        idFuncion: null,
      });

    funciones = resultado.funciones;
    truncado = resultado.truncado;
  } catch {
    errorFunciones =
      "No se pudieron consultar las funciones.";
  }

  const funcionSeleccionada =
    idFuncion === null
      ? null
      : funciones.find(
          (f) => f.id === idFuncion,
        ) ?? null;

  let asistentes: AsistenteFuncion[] = [];
  let ocupacion:
    | Awaited<
        ReturnType<
          typeof consultarOcupacionFuncion
        >
      >
    | null = null;

  let errorConsulta: string | null = null;

  if (idFuncion !== null) {
    try {
      const [
        resultadoAsistentes,
        resultadoOcupacion,
      ] = await Promise.all([
        listarAsistentesFuncion(
          idFuncion,
          tipo,
          busqueda,
        ),
        consultarOcupacionFuncion(
          idFuncion,
        ),
      ]);

      asistentes = resultadoAsistentes;
      ocupacion = resultadoOcupacion;
    } catch {
      errorConsulta =
        "No se pudo consultar la información de la función. Intenta nuevamente.";
    }
  }

  const filtrando =
    idFuncion !== null &&
    busqueda.length > 0;

  const sinResultados =
    idFuncion !== null &&
    !errorConsulta &&
    asistentes.length === 0;

  const capacidad =
    ocupacion?.resumen.capacidad ?? 0;

  const reservados =
    ocupacion?.resumen.reservados ?? 0;

  const porcentajeReservado =
    capacidad > 0
      ? (reservados / capacidad) * 100
      : 0;

  return (
    <div className="space-y-6">
      <header>
        <Link
          href="/admin/entradas"
          className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground transition-colors hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a Entradas
        </Link>

        <h1 className="text-3xl tracking-wide">
          Personas por función y sala
        </h1>

        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
          Selecciona una función para consultar
          las personas con reserva, sus asientos,
          estado y la ocupación correspondiente
          de la sala.
        </p>
      </header>

      <section className="card-surface p-6">
        <form
          method="get"
          className="space-y-5"
        >
          <div>
            <label
              htmlFor="funcion"
              className="label"
            >
              Función
            </label>

            <select
              id="funcion"
              name="funcion"
              className="field"
              defaultValue={
                idFuncion ?? ""
              }
            >
              <option value="">
                Selecciona una función
              </option>

              {funciones.map((funcion) => (
                <option
                  key={funcion.id}
                  value={funcion.id}
                >
                  {etiquetaFuncionOpcion(
                    funcion,
                  )}
                </option>
              ))}
            </select>

            {truncado && (
              <p className="mt-1 text-xs text-muted-foreground">
                Se muestran las 300 funciones
                más recientes.
              </p>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-[220px_1fr_auto] md:items-end">
            <div>
              <label
                htmlFor="tipo"
                className="label"
              >
                Filtrar por
              </label>

              <select
                id="tipo"
                name="tipo"
                className="field"
                defaultValue={tipo}
              >
                {TIPOS_BUSQUEDA.map(
                  (opcion) => (
                    <option
                      key={opcion.id}
                      value={opcion.id}
                    >
                      {opcion.etiqueta}
                    </option>
                  ),
                )}
              </select>
            </div>

            <div>
              <label
                htmlFor="buscar"
                className="label"
              >
                Búsqueda
              </label>

              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

                <input
                  id="buscar"
                  name="buscar"
                  type="search"
                  className="field pl-10"
                  defaultValue={busqueda}
                  placeholder={
                    TIPOS_BUSQUEDA.find(
                      (x) =>
                        x.id === tipo,
                    )?.placeholder ??
                    "Buscar"
                  }
                  autoComplete="off"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                className="btn-primary"
              >
                Consultar
              </button>

              {(filtrando ||
                idFuncion !== null) && (
                <Link
                  href={
                    idFuncion !== null
                      ? `/admin/entradas/asistentes?funcion=${idFuncion}`
                      : "/admin/entradas/asistentes"
                  }
                  className="btn-ghost"
                >
                  Limpiar filtro
                </Link>
              )}
            </div>
          </div>
        </form>

        {errorFunciones && (
          <p
            role="alert"
            className="mt-5 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {errorFunciones}
          </p>
        )}
      </section>

      {idFuncion === null && (
        <div className="card-surface p-8 text-center">
          <Users className="mx-auto h-10 w-10 text-muted-foreground" />

          <h2 className="mt-4 text-xl font-semibold">
            Selecciona una función
          </h2>

          <p className="mt-2 text-sm text-muted-foreground">
            Elige una función para consultar
            sus asistentes y la ocupación de
            la sala.
          </p>
        </div>
      )}

      {idFuncion !== null &&
        !errorConsulta && (
          <>
            <section className="grid gap-4 md:grid-cols-3">
              <div className="card-surface p-5">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  Función
                </p>

                <p className="mt-2 font-semibold">
                  {ocupacion?.funcion
                    .pelicula ??
                    funcionSeleccionada
                      ?.pelicula ??
                    "—"}
                </p>

                <p className="mt-1 text-sm text-muted-foreground">
                  {ocupacion
                    ? `${formatearFecha(
                        ocupacion.funcion
                          .fecha,
                      )} · ${
                        ocupacion.funcion
                          .hora
                      } Hrs.`
                    : "—"}
                </p>
              </div>

              <div className="card-surface p-5">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  Sala
                </p>

                <p className="mt-2 font-semibold">
                  {ocupacion?.funcion.sala ??
                    funcionSeleccionada
                      ?.sala ??
                    "—"}
                </p>

                {ocupacion &&
                  !ocupacion.funcion
                    .activa && (
                    <p className="mt-1 text-sm font-medium text-destructive">
                      Función cancelada
                    </p>
                  )}
              </div>

              <div className="card-surface p-5">
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  Ocupación
                </p>

                <p className="mt-2 text-2xl font-semibold text-primary">
                  {reservados} /{" "}
                  {capacidad}
                </p>

                <p className="mt-1 text-sm text-muted-foreground">
                  Asientos reservados ·{" "}
                  {porcentajeReservado.toLocaleString(
                    "es-GT",
                    {
                      maximumFractionDigits: 2,
                    },
                  )}
                  %
                </p>
              </div>
            </section>

            <section className="card-surface">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-6">
                <div>
                  <h2 className="text-2xl tracking-wide">
                    Personas con reserva
                  </h2>

                  <p className="mt-1 text-sm text-muted-foreground">
                    {filtrando
                      ? `Resultados para “${busqueda}”.`
                      : "Reservas asociadas a la función seleccionada."}
                  </p>
                </div>

                <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-2 px-3 py-1 text-sm text-muted-foreground">
                  <Users className="h-4 w-4" />

                  {asistentes.length}{" "}
                  {asistentes.length === 1
                    ? "reserva"
                    : "reservas"}
                </span>
              </div>

              {sinResultados ? (
                <div
                  role="status"
                  className="m-6 rounded-md border border-border bg-surface-2 px-4 py-6 text-center"
                >
                  <p className="font-medium">
                    No se encontraron
                    resultados.
                  </p>

                  <p className="mt-1 text-sm text-muted-foreground">
                    Revisa el filtro aplicado e
                    intenta nuevamente.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-surface-2 text-left uppercase tracking-wider text-muted-foreground">
                        <th className="px-5 py-3">
                          ID entrada
                        </th>

                        <th className="px-5 py-3">
                          Cliente
                        </th>

                        <th className="px-5 py-3">
                          Reserva
                        </th>

                        <th className="px-5 py-3">
                          Asientos
                        </th>

                        <th className="px-5 py-3">
                          Estado
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {asistentes.map(
                        (asistente) => (
                          <tr
                            key={
                              asistente.idReserva
                            }
                            className="border-b border-border last:border-b-0"
                          >
                            <td className="whitespace-nowrap px-5 py-4 font-semibold">
                              #
                              {
                                asistente.idBoleto
                              }
                            </td>

                            <td className="px-5 py-4">
                              <p className="font-medium">
                                {
                                  asistente.nombreComprador
                                }
                              </p>

                              <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                                <Mail className="h-3 w-3" />
                                {
                                  asistente.correoComprador
                                }
                              </p>
                            </td>

                            <td className="whitespace-nowrap px-5 py-4 font-semibold text-primary">
                              {numeroReserva(
                                asistente.idReserva,
                              )}
                            </td>

                            <td className="px-5 py-4">
                              <p>
                                {asistente
                                  .asientos
                                  .length > 0
                                  ? asistente.asientos.join(
                                      ", ",
                                    )
                                  : "—"}
                              </p>

                              <p className="mt-1 text-xs text-muted-foreground">
                                {
                                  asistente.cantidadAsientos
                                }{" "}
                                {asistente.cantidadAsientos ===
                                1
                                  ? "asiento"
                                  : "asientos"}
                              </p>
                            </td>

                            <td className="px-5 py-4">
                              <EstadoBadge
                                estado={
                                  asistente.estado
                                }
                              />

                              {asistente.estado ===
                                "Cancelada" && (
                                <p className="mt-1 text-xs font-medium text-destructive">
                                  No válida para
                                  acceso
                                </p>
                              )}
                            </td>
                          </tr>
                        ),
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <p className="text-xs text-muted-foreground">
              Esta pantalla es únicamente de
              consulta. Para registrar el ingreso
              de una persona utiliza el módulo
              “Validar entrada”.
            </p>
          </>
        )}

      {errorConsulta && (
        <p
          role="alert"
          className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        >
          {errorConsulta}
        </p>
      )}
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

function enteroPositivo(
  valor: string,
): number | null {
  if (!/^\d+$/.test(valor)) {
    return null;
  }

  const numero = Number(valor);

  return Number.isSafeInteger(numero) &&
    numero > 0
    ? numero
    : null;
}

function tipoBusqueda(
  valor: string,
): TipoBusquedaAsistente {
  if (
    valor === "nombre" ||
    valor === "correo"
  ) {
    return valor;
  }

  return "entrada";
}

function formatearFecha(
  fecha: string,
): string {
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
  estado: EstadoAsistente;
}) {
  const estilos: Record<
    EstadoAsistente,
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