"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Minus,
  Plus,
} from "lucide-react";

import { SiteHeader } from "@/components/cinema/SiteHeader";
import { SiteFooter } from "@/components/cinema/SiteFooter";
import { FunctionHeader } from "@/components/cinema/FunctionHeader";
import {
  B15,
  C,
  etiquetaFuncion,
  MAX_ENTRADAS_POR_COMPRA,
  quetzales,
  type Cantidades,
} from "@/lib/compra";
import type { FuncionConPrecios } from "@/lib/db/compra";
import {
  TIPOS_ENTRADA,
  type TipoEntradaId,
} from "@/lib/entradas";
import { toHref } from "@/lib/search-params";

/**
 * SCRUM-117 / SCRUM-139:
 * selección de tipo y cantidad de entradas para una función real.
 *
 * Los precios vienen de la sala de la función (SCRUM-121).
 * El porcentaje de recargo mostrado también procede de la configuración
 * persistente consultada por el servidor.
 *
 * El total mostrado aquí antes de continuar es únicamente el subtotal
 * informativo de entradas. El resumen monetario definitivo se recalcula
 * siempre en el servidor mediante `calcularResumenCompra`.
 */
export function EntradasClient({
  datos,
  cantidadesIniciales,
  porcentajeRecargo,
}: {
  datos: FuncionConPrecios;
  cantidadesIniciales: Cantidades;
  porcentajeRecargo: number;
}) {
  const [qty, setQty] =
    useState<Cantidades>(
      cantidadesIniciales,
    );

  const [
    limitReached,
    setLimitReached,
  ] = useState(false);

  const ticketCount =
    TIPOS_ENTRADA.reduce(
      (sum, t) =>
        sum + qty[t.id],
      0,
    );

  const change = (
    id: TipoEntradaId,
    delta: number,
  ) => {
    if (
      delta > 0 &&
      ticketCount >=
        MAX_ENTRADAS_POR_COMPRA
    ) {
      setLimitReached(true);
      return;
    }

    setLimitReached(false);

    setQty((q) => ({
      ...q,
      [id]: Math.max(
        0,
        q[id] + delta,
      ),
    }));
  };

  if (!datos.ok) {
    return (
      <div className="flex min-h-screen flex-col">
        <SiteHeader />

        <main className="mx-auto w-full max-w-[1100px] flex-1 px-6 py-10">
          <FunctionHeader
            title="Función no disponible"
            subtitle="Vuelve a la cartelera para elegir otra función."
          />

          <section className="card-surface p-8">
            <p
              role="alert"
              className="text-lg"
            >
              {datos.error}
            </p>

            <div className="mt-6 flex justify-end">
              <Link
                href="/"
                className="btn-primary px-10"
              >
                Volver a la cartelera
              </Link>
            </div>
          </section>
        </main>

        <SiteFooter />
      </div>
    );
  }

  const { funcion, precios } =
    datos;

  const total =
    TIPOS_ENTRADA.reduce(
      (sum, t) =>
        sum +
        precios[t.id] *
          qty[t.id],
      0,
    );

  const sinNinos =
    funcion.clasificacion ===
      B15 ||
    funcion.clasificacion ===
      C;

  const tiposVisibles =
    sinNinos
      ? TIPOS_ENTRADA.filter(
          (t) =>
            t.id !==
            "ninos",
        )
      : TIPOS_ENTRADA;

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-[1100px] flex-1 px-6 py-10">
        <FunctionHeader
          title={
            funcion.pelicula
          }
          subtitle={etiquetaFuncion(
            funcion,
          )}
        />

        <section className="card-surface p-8">
          <h2 className="section-title mb-6">
            Seleccione sus entradas
          </h2>

          <ul className="divide-y divide-border">
            {tiposVisibles.map(
              (t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between gap-6 py-5"
                >
                  <div>
                    <p className="text-lg font-semibold">
                      {t.nombre}{" "}
                      <span className="text-primary">
                        {quetzales(
                          precios[
                            t.id
                          ],
                        )}
                      </span>
                    </p>

                    <p className="text-sm text-muted-foreground">
                      (
                      {
                        t.rangoEdad
                      }
                      )
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        change(
                          t.id,
                          -1,
                        )
                      }
                      aria-label={`Quitar entrada ${t.nombre}`}
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-secondary transition-colors hover:border-primary hover:text-primary"
                    >
                      <Minus className="h-4 w-4" />
                    </button>

                    <span className="w-8 text-center text-lg font-semibold">
                      {
                        qty[
                          t.id
                        ]
                      }
                    </span>

                    <button
                      type="button"
                      onClick={() =>
                        change(
                          t.id,
                          1,
                        )
                      }
                      aria-label={`Agregar entrada ${t.nombre}`}
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-secondary transition-colors hover:border-primary hover:text-primary"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ),
            )}
          </ul>

          {limitReached && (
            <p className="mt-6 text-sm text-primary">
              Has alcanzado el
              límite máximo de{" "}
              {
                MAX_ENTRADAS_POR_COMPRA
              }{" "}
              entradas por compra.
            </p>
          )}

          <p className="mt-6 rounded-lg bg-surface-2 px-4 py-3 text-sm text-muted-foreground">
            Al realizar el pago se
            aplicará un recargo del{" "}
            <span className="font-semibold text-foreground">
              {porcentajeRecargo.toFixed(
                2,
              )}
              %
            </span>{" "}
            sobre el subtotal de la
            compra.
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6">
            <p className="text-lg">
              Total tickets
              seleccionados{" "}
              <span className="font-display text-3xl text-primary">
                {quetzales(
                  total,
                )}
              </span>
            </p>

            <div className="flex gap-3">
              <Link
                href={toHref(
                  `/pelicula/${funcion.slug}`,
                  {
                    fecha:
                      funcion.fecha,
                    funcion:
                      funcion.id,
                  },
                )}
                className="btn-ghost"
              >
                Cancelar
              </Link>

              {ticketCount >
              0 ? (
                <Link
                  href={toHref(
                    "/asientos",
                    {
                      funcion:
                        funcion.id,
                      adulto:
                        qty.adulto,
                      tercera:
                        qty.tercera,
                      ninos:
                        sinNinos
                          ? 0
                          : qty.ninos,
                    },
                  )}
                  className="btn-primary px-10"
                >
                  Continuar
                </Link>
              ) : (
                <span
                  aria-disabled="true"
                  title="Elige al menos 1 entrada"
                  className="btn-primary pointer-events-none px-10 opacity-50"
                >
                  Continuar
                </span>
              )}
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
