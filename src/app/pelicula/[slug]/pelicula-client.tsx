"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { SiteHeader } from "@/components/cinema/SiteHeader";
import { getHalls, getMovie } from "@/lib/cinema-data";
import { toHref } from "@/lib/search-params";

export function PeliculaClient({ slug }: { slug: string }) {
  const movie = getMovie(slug);
  const halls = getHalls(movie);
  const defaultHall = halls[1] ?? halls[0]!;
  const defaultTime = defaultHall.times[2] ?? defaultHall.times[0]!;
  const [selected, setSelected] = useState(
    `${defaultHall.name}-${defaultTime.time}`,
  );
  const current =
    halls
      .flatMap((h) => h.times.map((t) => ({ hall: h.name, ...t })))
      .find((x) => `${x.hall}-${x.time}` === selected) ??
    { hall: defaultHall.name, ...defaultTime };

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto grid max-w-[1400px] gap-10 px-6 py-10 lg:grid-cols-[1fr_552px]">
        <section>
          <h1 className="text-5xl uppercase tracking-[0.12em] md:text-6xl">{movie.title}</h1>

          <div className="mt-8 space-y-8">
            {halls.map((hall) => (
              <div key={hall.name}>
                <h2 className="section-title">{hall.name}</h2>
                <p className="mb-3 mt-2 text-sm uppercase tracking-widest text-muted-foreground">
                  Horarios
                </p>
                <div className="flex flex-wrap gap-3">
                  {hall.times.map((t) => {
                    const key = `${hall.name}-${t.time}`;
                    const active = selected === key;
                    return (
                      <button
                        key={key}
                        onClick={() => setSelected(key)}
                        className={`min-w-[130px] rounded-lg border px-4 py-3 text-center transition-all ${
                          active
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-surface-2 hover:border-primary hover:text-primary"
                        }`}
                      >
                        <span className="block text-lg font-semibold">{t.time}</span>
                        <span className="text-xs">{t.format}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-6 h-px bg-border" />
              </div>
            ))}
          </div>

          <div className="mt-8 flex justify-end">
            <Link
              href={toHref("/entradas", {
                slug: movie.slug,
                hall: current.hall,
                time: current.time,
                format: current.format,
              })}
              className="btn-primary px-10"
            >
              Continuar
            </Link>
          </div>
        </section>

        <aside className="card-surface h-fit overflow-hidden">
          <Image
            priority
            src={movie.poster}
            alt={`Póster de ${movie.title}`}
            width={512}
            height={768}
            className="aspect-[2/3] w-2/3 mx-auto mt-6 object-cover"
          />
          <div className="p-6">
            <h2 className="text-2xl tracking-wide">{movie.title}</h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {movie.synopsis}
            </p>
            <dl className="mt-5 space-y-1.5 text-sm">
              <div className="flex gap-2">
                <dt className="font-semibold text-secondary">Director:</dt>
                <dd className="text-muted-foreground">{movie.director}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="font-semibold text-secondary">Actor principal:</dt>
                <dd className="text-muted-foreground">{movie.actor}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="font-semibold text-secondary">Estudio:</dt>
                <dd className="text-muted-foreground">{movie.studio}</dd>
              </div>
            </dl>
          </div>
        </aside>
      </main>
    </div>
  );
}
