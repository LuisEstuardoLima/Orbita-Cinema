"use client";

import Link from "next/link";
import { useState } from "react";
import { SiteHeader } from "@/components/cinema/SiteHeader";
import { FunctionHeader } from "@/components/cinema/FunctionHeader";
import { COLS, ROWS, getPreselected, getReserved } from "@/lib/cinema-data";
import {
  etiquetaFuncion,
  fechaCortaFuncion,
  quetzales,
  salaFuncion,
  type ResumenCompra,
} from "@/lib/compra";
import { toHref } from "@/lib/search-params";

type Props = {
  slug: string;
  hall: string;
  time: string;
  format: string;
  adulto: number;
  tercera: number;
  ninos: number;
  /** SCRUM-122: función y resumen calculados en el servidor (`calcularResumenCompra`). */
  idFuncion: number;
  resumen: ResumenCompra | null;
  errorResumen: string | null;
};

const SEAT_CAP = 10;

export function AsientosClient(search: Props) {
  const slug = search.slug || "batman";
  const { resumen, errorResumen } = search;
  const reserved = getReserved(slug);

  const tickets = search.adulto + search.tercera + search.ninos;
  const maxSeats = tickets > 0 ? Math.min(SEAT_CAP, tickets) : SEAT_CAP;

  const [selected, setSelected] = useState<string[]>(() =>
    getPreselected(slug).slice(0, maxSeats),
  );
  const [limitReached, setLimitReached] = useState(false);

  const toggle = (seat: string) => {
    if (reserved.includes(seat)) return;
    setSelected((s) => {
      if (s.includes(seat)) {
        setLimitReached(false);
        return s.filter((x) => x !== seat);
      }
      if (s.length >= maxSeats) {
        setLimitReached(true);
        return s;
      }
      return [...s, seat];
    });
  };

  // Para "Cancelar": volver a /entradas con la misma función y cantidades.
  const volverAEntradas = toHref("/entradas", {
    funcion: search.idFuncion,
    adulto: search.adulto,
    tercera: search.tercera,
    ninos: search.ninos,
  });

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-[1400px] px-6 py-10">
        <FunctionHeader
          title={resumen ? resumen.funcion.pelicula : "Función no disponible"}
          subtitle={
            resumen
              ? etiquetaFuncion(resumen.funcion)
              : "Vuelve a la cartelera para elegir otra función."
          }
        />

        <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
          <section className="card-surface p-6">
            <div className="mx-auto mb-8 max-w-2xl">
              <div className="rounded-t-[50%] border-t-4 border-primary bg-linear-to-b from-primary/25 to-transparent py-4 text-center">
                <span className="font-display text-2xl tracking-[0.3em] text-secondary">
                  PANTALLA
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <div className="mx-auto w-fit">
                {ROWS.map((row) => (
                  <div key={row} className="mb-1.5 flex items-center gap-2">
                    <span className="w-4 text-xs text-muted-foreground">{row}</span>
                    <div className="flex gap-1.5">
                      {COLS.map((col) => {
                        const seat = `${row}${col}`;
                        const isReserved = reserved.includes(seat);
                        const isSelected = selected.includes(seat);
                        return (
                          <button
                            key={seat}
                            onClick={() => toggle(seat)}
                            aria-label={`Asiento ${seat}`}
                            className={`h-5 w-5 rounded-[4px] border transition-all ${
                              isReserved
                                ? "cursor-not-allowed border-transparent bg-muted-foreground/60"
                                : isSelected
                                  ? "border-primary bg-primary"
                                  : "border-border bg-surface-2 hover:border-primary hover:bg-primary/30"
                            }`}
                          />
                        );
                      })}
                    </div>
                  </div>
                ))}
                <div className="mt-2 flex items-center gap-2">
                  <span className="w-4" />
                  <div className="flex gap-1.5">
                    {COLS.map((c) => (
                      <span
                        key={c}
                        className="w-5 text-center text-[10px] text-muted-foreground"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <aside className="card-surface h-fit p-6">
            <h2 className="text-3xl tracking-wide">Reserva:</h2>

            <ul className="mt-4 space-y-3 text-sm">
              <li className="flex items-center gap-3">
                <span className="h-5 w-5 rounded-[4px] border border-border bg-surface-2" />
                Disponible
              </li>
              <li className="flex items-center gap-3">
                <span className="h-5 w-5 rounded-[4px] border border-primary bg-primary" />
                Seleccionado
              </li>
              <li className="flex items-center gap-3">
                <span className="h-5 w-5 rounded-[4px] bg-muted-foreground/60" />
                Reservado
              </li>
            </ul>

            <div className="my-5 h-px bg-border" />

            <p className="text-lg">
              Selección:{" "}
              <span className="font-semibold text-primary">
                {selected.length ? selected.join(", ") : "—"}
              </span>
            </p>
            {limitReached && (
              <p className="mt-2 text-sm text-primary">
                Has alcanzado el límite máximo de {maxSeats} asientos.
              </p>
            )}

            <div className="my-5 h-px bg-border" />

            {/* SCRUM-122: todo el cuadro sale de `calcularResumenCompra` (servidor). */}
            <h3 className="mb-3 text-xl tracking-wide">Confirmación</h3>
            {resumen ? (
              <dl className="space-y-2 rounded-lg bg-surface-2 p-4 text-sm">
                <Row label="Película" value={resumen.funcion.pelicula} multilinea />
                <Row
                  label="Horario"
                  value={`${fechaCortaFuncion(resumen.funcion.fecha)} · ${resumen.funcion.hora} Hrs.`}
                />
                <Row label="Sala" value={salaFuncion(resumen.funcion)} />
                <div className="mt-2 space-y-2 border-t border-border pt-2">
                  {resumen.lineas
                    .filter((l) => l.cantidad > 0)
                    .map((l) => (
                      <Row
                        key={l.tipo}
                        label={`${l.cantidad} × ${l.nombre}`}
                        value={quetzales(l.importe)}
                        plain
                      />
                    ))}
                </div>
                <div className="mt-2 space-y-2 border-t border-border pt-2">
                  <Row label="Subtotal" value={quetzales(resumen.subtotal)} />
                  <Row label="Recargo" value={quetzales(resumen.recargo)} />
                </div>
                <div className="mt-2 border-t border-border pt-2">
                  <Row label="Total" value={quetzales(resumen.total)} highlight />
                </div>
              </dl>
            ) : (
              <div className="rounded-lg bg-surface-2 p-4 text-sm">
                <p role="alert" className="text-destructive">
                  {errorResumen}
                </p>
                <Link
                  href="/"
                  className="mt-3 inline-block font-semibold text-primary hover:underline"
                >
                  Volver a la cartelera
                </Link>
              </div>
            )}

            <div className="mt-6 flex gap-3">
              <Link href={volverAEntradas} className="btn-ghost flex-1">
                Cancelar
              </Link>
              {resumen ? (
                // TODO SCRUM-124: /pago debe recalcular el total con `calcularResumenCompra`
                // (con `funcion` y las cantidades que ya viajan aquí) en lugar de confiar en el
                // parámetro `total` de la URL, que el usuario puede editar.
                <Link
                  href={toHref("/pago", {
                    slug,
                    hall: search.hall,
                    time: search.time,
                    format: search.format,
                    seats: selected.join(","),
                    total: resumen.total,
                    funcion: search.idFuncion,
                    adulto: search.adulto,
                    tercera: search.tercera,
                    ninos: search.ninos,
                  })}
                  className="btn-primary flex-1"
                >
                  Continuar
                </Link>
              ) : (
                <span
                  aria-disabled="true"
                  className="btn-primary pointer-events-none flex-1 opacity-50"
                >
                  Continuar
                </span>
              )}
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

function Row({
  label,
  value,
  highlight,
  plain,
  multilinea,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  /** Sin ":" tras la etiqueta (líneas del desglose, p. ej. "2 × Adulto"). */
  plain?: boolean;
  /** Valor que puede ocupar varias líneas (p. ej. el título de la película): se alinea a la
   * derecha, con separación de la etiqueta, y la etiqueta no se parte. */
  multilinea?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between${multilinea ? " gap-3" : ""}`}>
      <dt className={`text-muted-foreground${multilinea ? " shrink-0 whitespace-nowrap" : ""}`}>
        {label}
        {plain ? "" : ":"}
      </dt>
      <dd
        className={`${highlight ? "text-lg font-bold text-primary" : "font-medium"}${
          multilinea ? " text-right" : ""
        }`}
      >
        {value}
      </dd>
    </div>
  );
}
