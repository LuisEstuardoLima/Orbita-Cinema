"use client";

/**
 * Detalle de una película — la parte que corre en el NAVEGADOR ("use client").
 *
 * Recibe la película ya consultada desde `page.tsx` y maneja la interacción: elegir día
 * (chips de fecha) y elegir función (los horarios, agrupados por sala).
 *
 * Estado:
 * - `fecha`: qué día se está viendo.
 * - `selId`: qué función está elegida. De ahí sale el botón "Continuar", que solo se habilita
 *   si hay una función seleccionada.
 *
 * Cuando la URL trae una función (`funcionInicial`, venís desde la cartelera con una hora
 * elegida), esa gana: el día se deduce de la función, no al revés.
 *
 * Cada cambio escribe en la URL con `window.history.replaceState` para que recargar o compartir
 * el link no pierda la selección.
 */
import Link from "next/link";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { SiteHeader } from "@/components/cinema/SiteHeader";
import { PosterImage } from "@/components/cinema/PosterImage";
import { agruparPorSala, type PeliculaVM } from "@/lib/cartelera";
import { parseFecha } from "@/lib/fechas";
import { toHref } from "@/lib/search-params";

const mayus = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const fechaPill = (fecha: string) => mayus(format(parseFecha(fecha), "EEE dd MMM", { locale: es }));

export function PeliculaClient({
  pelicula,
  fechaInicial,
  funcionInicial,
}: {
  pelicula: PeliculaVM;
  fechaInicial?: string;
  funcionInicial?: number;
}) {
  const fechas = useMemo(
    () => [...new Set(pelicula.funciones.map((f) => f.fecha))],
    [pelicula.funciones],
  );
  // Si la URL trae una función vigente, manda sobre la fecha (su día se deduce de ella).
  const funcionUrl = pelicula.funciones.find((f) => f.id === funcionInicial);
  const fechaDefault =
    funcionUrl?.fecha ??
    (fechaInicial && fechas.includes(fechaInicial) ? fechaInicial : (fechas[0] ?? ""));

  const [fecha, setFecha] = useState(fechaDefault);
  const [selId, setSelId] = useState<number | null>(
    funcionUrl?.id ?? pelicula.funciones.find((f) => f.fecha === fechaDefault)?.id ?? null,
  );

  const delDia = pelicula.funciones.filter((f) => f.fecha === fecha);
  const salas = agruparPorSala(delDia);
  const actual = pelicula.funciones.find((f) => f.id === selId) ?? null;

  /** Refleja la selección en la URL (sin recargar) para conservarla al recargar o volver atrás. */
  const sincronizarUrl = (f: string, id: number | null) => {
    const q = new URLSearchParams(window.location.search);
    q.set("fecha", f);
    if (id == null) q.delete("funcion");
    else q.set("funcion", String(id));
    window.history.replaceState(null, "", `?${q.toString()}`);
  };

  const cambiarFecha = (f: string) => {
    const id = pelicula.funciones.find((fn) => fn.fecha === f)?.id ?? null;
    setFecha(f);
    setSelId(id);
    sincronizarUrl(f, id);
  };

  const elegirFuncion = (id: number) => {
    setSelId(id);
    sincronizarUrl(fecha, id);
  };

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto grid max-w-[1400px] gap-10 px-6 py-10 lg:grid-cols-[1fr_552px]">
        <section>
          <h1 className="text-5xl uppercase tracking-[0.12em] md:text-6xl">{pelicula.titulo}</h1>

          {fechas.length === 0 ? (
            <p className="mt-8 text-sm text-muted-foreground">
              Esta película no tiene funciones programadas por ahora.
            </p>
          ) : (
            <>
              <div className="mt-8 flex flex-wrap gap-2">
                {fechas.map((f) => (
                  <button
                    key={f}
                    onClick={() => cambiarFecha(f)}
                    className={f === fecha ? "chip chip-active" : "chip"}
                  >
                    {fechaPill(f)}
                  </button>
                ))}
              </div>

              <div className="mt-8 space-y-8">
                {salas.map(({ sala, funciones }) => (
                  <div key={sala.id}>
                    <h2 className="section-title">
                      {sala.nombre}{" "}
                      {sala.tipo && <span className="text-muted-foreground">· {sala.tipo}</span>}
                    </h2>
                    <p className="mb-3 mt-2 text-sm uppercase tracking-widest text-muted-foreground">
                      Horarios
                    </p>
                    <div className="flex flex-wrap gap-3">
                      {funciones.map((fn) => (
                        <button
                          key={fn.id}
                          onClick={() => elegirFuncion(fn.id)}
                          className={`min-w-[130px] rounded-lg border px-4 py-3 text-center transition-all ${
                            selId === fn.id
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-surface-2 hover:border-primary hover:text-primary"
                          }`}
                        >
                          <span className="block text-lg font-semibold">{fn.hora}</span>
                          <span className="text-xs">{fn.formato}</span>
                        </button>
                      ))}
                    </div>
                    <div className="mt-6 h-px bg-border" />
                  </div>
                ))}
              </div>

              <div className="mt-8 flex justify-end">
                {actual ? (
                  <Link
                    href={toHref("/entradas", {
                      slug: pelicula.slug,
                      funcion: actual.id,
                      hall: actual.sala.nombre,
                      time: actual.hora,
                      format: actual.formato,
                    })}
                    className="btn-primary px-10"
                  >
                    Continuar
                  </Link>
                ) : (
                  <span className="btn-primary pointer-events-none px-10 opacity-50">Continuar</span>
                )}
              </div>
            </>
          )}
        </section>

        <aside className="card-surface h-fit overflow-hidden">
          <PosterImage
            priority
            src={pelicula.posterUrl}
            alt={`Póster de ${pelicula.titulo}`}
            className="mx-auto mt-6 aspect-[2/3] w-2/3 object-cover"
          />
          <div className="p-6">
            <h2 className="text-2xl tracking-wide">{pelicula.titulo}</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{pelicula.sinopsis}</p>
            <dl className="mt-5 space-y-1.5 text-sm">
              <Dato etiqueta="Clasificación" valor={pelicula.clasificacion} />
              <Dato etiqueta="Género" valor={pelicula.genero} />
              <Dato etiqueta="Director" valor={pelicula.director} />
              <Dato etiqueta="Actores" valor={pelicula.actor} />
              <Dato etiqueta="Estudio" valor={pelicula.estudio} />
            </dl>
          </div>
        </aside>
      </main>
    </div>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  if (!valor) return null;
  return (
    <div className="flex gap-2">
      <dt className="font-semibold text-secondary">{etiqueta}:</dt>
      <dd className="text-muted-foreground">{valor}</dd>
    </div>
  );
}
