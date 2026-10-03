"use client";

import Link from "next/link";
import { useState } from "react";
import { SiteHeader } from "@/components/cinema/SiteHeader";
import { FunctionHeader } from "@/components/cinema/FunctionHeader";
import {
  COLS,
  ROWS,
  TICKET_TYPES,
  buildFunctionLabel,
  getMovie,
  getPreselected,
  getReserved,
} from "@/lib/cinema-data";
import { toHref } from "@/lib/search-params";

type Props = {
  slug: string;
  hall: string;
  time: string;
  format: string;
  adulto: number;
  tercera: number;
  ninos: number;
};

const PRICE = 30;
const SEAT_CAP = 10;

export function AsientosClient(search: Props) {
  const slug = search.slug || "batman";
  const movie = getMovie(slug);
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

  const ticketsTotal = TICKET_TYPES.reduce(
    (sum, t) => sum + t.price * search[t.id as "adulto" | "tercera" | "ninos"],
    0,
  );
  const subtotal = tickets > 0 ? ticketsTotal : selected.length * PRICE;
  const recargo = subtotal * 0.05;

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-[1400px] px-6 py-10">
        <FunctionHeader
          title={movie.title}
          subtitle={buildFunctionLabel(search.hall, search.time, search.format)}
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

            <h3 className="mb-3 text-xl tracking-wide">Confirmación</h3>
            <dl className="space-y-2 rounded-lg bg-surface-2 p-4 text-sm">
              <Row label="Película" value={movie.title} />
              <Row label="Horario" value={`${search.time || "18:00"} Hrs.`} />
              <Row label="Sala" value={search.hall || "1 Regular 2D"} />
              <Row label="Subtotal" value={`Q.${subtotal.toFixed(2)}`} />
              <Row label="Recargo" value={`Q.${recargo.toFixed(2)}`} />
              <div className="mt-2 border-t border-border pt-2">
                <Row
                  label="Total"
                  value={`Q.${(subtotal + recargo).toFixed(2)}`}
                  highlight
                />
              </div>
            </dl>

            <div className="mt-6 flex gap-3">
              <Link
                href={toHref("/entradas", {
                  slug,
                  hall: search.hall,
                  time: search.time,
                  format: search.format,
                })}
                className="btn-ghost flex-1"
              >
                Cancelar
              </Link>
              <Link
                href={toHref("/pago", {
                  slug,
                  hall: search.hall,
                  time: search.time,
                  format: search.format,
                  seats: selected.join(","),
                  total: Number((subtotal + recargo).toFixed(2)),
                })}
                className="btn-primary flex-1"
              >
                Continuar
              </Link>
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
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}:</dt>
      <dd className={highlight ? "text-lg font-bold text-primary" : "font-medium"}>
        {value}
      </dd>
    </div>
  );
}
