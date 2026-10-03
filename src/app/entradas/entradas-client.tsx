"use client";

import Link from "next/link";
import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { SiteHeader } from "@/components/cinema/SiteHeader";
import { FunctionHeader } from "@/components/cinema/FunctionHeader";
import { buildFunctionLabel, getMovie, TICKET_TYPES } from "@/lib/cinema-data";
import { toHref } from "@/lib/search-params";

type Props = { slug: string; hall: string; time: string; format: string };

const TICKET_CAP = 10;

export function EntradasClient(search: Props) {
  const slug = search.slug || "batman";
  const movie = getMovie(slug);
  const [qty, setQty] = useState<Record<string, number>>({
    adulto: 1,
    tercera: 1,
    ninos: 1,
  });
  const [limitReached, setLimitReached] = useState(false);

  const ticketCount = Object.values(qty).reduce((a, b) => a + b, 0);

  const change = (id: string, delta: number) => {
    if (delta > 0 && ticketCount >= TICKET_CAP) {
      setLimitReached(true);
      return;
    }
    setLimitReached(false);
    setQty((q) => ({ ...q, [id]: Math.max(0, (q[id] ?? 0) + delta) }));
  };

  const total = TICKET_TYPES.reduce((sum, t) => sum + t.price * (qty[t.id] ?? 0), 0);

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto max-w-[1100px] px-6 py-10">
        <FunctionHeader
          title={movie.title}
          subtitle={buildFunctionLabel(search.hall, search.time, search.format)}
        />

        <section className="card-surface p-8">
          <h2 className="section-title mb-6">Seleccione sus entradas</h2>

          <ul className="divide-y divide-border">
            {TICKET_TYPES.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-6 py-5">
                <div>
                  <p className="text-lg font-semibold">
                    {t.label}{" "}
                    <span className="text-primary">Q.{t.price.toFixed(2)}</span>
                  </p>
                  <p className="text-sm text-muted-foreground">{t.note}</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => change(t.id, -1)}
                    aria-label={`Quitar entrada ${t.label}`}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-secondary transition-colors hover:border-primary hover:text-primary"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="w-8 text-center text-lg font-semibold">{qty[t.id]}</span>
                  <button
                    onClick={() => change(t.id, 1)}
                    aria-label={`Agregar entrada ${t.label}`}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-secondary transition-colors hover:border-primary hover:text-primary"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>

          {limitReached && (
            <p className="mt-6 text-sm text-primary">
              Has alcanzado el límite máximo de {TICKET_CAP} entradas por compra.
            </p>
          )}

          <p className="mt-6 rounded-lg bg-surface-2 px-4 py-3 text-sm text-muted-foreground">
            Al realizar el pago se le hará un recargo del 5% al total de la compra
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-border pt-6">
            <p className="text-lg">
              Total tickets seleccionados{" "}
              <span className="font-display text-3xl text-primary">
                Q.{total.toFixed(2)}
              </span>
            </p>
            <div className="flex gap-3">
              <Link href={`/pelicula/${slug}`} className="btn-ghost">
                Cancelar
              </Link>
              <Link
                href={toHref("/asientos", {
                  slug,
                  hall: search.hall,
                  time: search.time,
                  format: search.format,
                  adulto: qty["adulto"] ?? 0,
                  tercera: qty["tercera"] ?? 0,
                  ninos: qty["ninos"] ?? 0,
                })}
                className="btn-primary px-10"
              >
                Continuar
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
