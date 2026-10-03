"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Search, CalendarDays, Clock, Languages, Check } from "lucide-react";
import { SiteHeader } from "@/components/cinema/SiteHeader";
import { Modal } from "@/components/cinema/Modal";
import { MOVIES } from "@/lib/cinema-data";

const RATINGS = ["A", "B", "B12", "B15", "C"];
const SLOTS = [
  { label: "Horario Matinal", range: "11:00 - 12:00" },
  { label: "Horario Vespertino", range: "13:00 - 18:00" },
  { label: "Horario Nocturno", range: "19:00 - 23:00" },
];
const LANGS = ["Español", "Inglés"];

export function CarteleraClient() {
  const [dateOpen, setDateOpen] = useState(false);
  const [slotOpen, setSlotOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [date, setDate] = useState("Viernes: 04 de septiembre");
  const [day, setDay] = useState(4);
  const [slot, setSlot] = useState("Horario Vespertino (13:00 - 18:00)");
  const [lang, setLang] = useState("Español");
  const [ratings, setRatings] = useState<string[]>(["B12"]);
  const [query, setQuery] = useState("");

  const [applied, setApplied] = useState<{
    query: string;
    slot: string | null;
    lang: string | null;
    ratings: string[];
  }>({ query: "", slot: null, lang: null, ratings: [] });

  const inSlot = (times: string[], slotValue: string) => {
    const match = /\((\d{2}):\d{2} - (\d{2}):\d{2}\)/.exec(slotValue);
    if (!match) return true;
    const from = Number(match[1]);
    const to = Number(match[2]);
    return times.some((t) => {
      const h = Number(t.slice(0, 2));
      return h >= from && h <= to;
    });
  };

  const visible = MOVIES.filter((m) => {
    if (applied.query && !m.title.toLowerCase().includes(applied.query.toLowerCase()))
      return false;
    if (applied.slot && !inSlot(m.times, applied.slot)) return false;
    if (applied.lang && !m.languages.includes(applied.lang)) return false;
    if (applied.ratings.length && !applied.ratings.includes(m.rating)) return false;
    return true;
  });

  const apply = () => setApplied({ query, slot, lang, ratings });

  const reset = () => {
    setQuery("");
    setDate("Viernes: 04 de septiembre");
    setDay(4);
    setSlot("Horario Vespertino (13:00 - 18:00)");
    setLang("Español");
    setRatings(["B12"]);
    setApplied({ query: "", slot: null, lang: null, ratings: [] });
  };

  const toggleRating = (r: string) =>
    setRatings((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto grid max-w-[1400px] gap-8 px-6 py-8 lg:grid-cols-[300px_1fr]">
        {/* Panel de filtros */}
        <aside className="card-surface h-fit p-5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className="field pl-9"
              placeholder="Buscar función"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          <div className="my-5 h-px bg-border" />

          <div className="space-y-5">
            <div>
              <button className="btn-ghost w-full" onClick={() => setDateOpen(true)}>
                <CalendarDays className="h-4 w-4" /> Elegir fecha
              </button>
              <p className="mt-2 text-center text-sm text-muted-foreground">{date}</p>
            </div>
            <div>
              <button className="btn-ghost w-full" onClick={() => setSlotOpen(true)}>
                <Clock className="h-4 w-4" /> Elegir Horario
              </button>
              <p className="mt-2 text-center text-sm text-muted-foreground">{slot}</p>
            </div>
            <div>
              <button className="btn-ghost w-full" onClick={() => setLangOpen(true)}>
                <Languages className="h-4 w-4" /> Elegir idioma
              </button>
              <p className="mt-2 text-center text-sm text-muted-foreground">{lang}</p>
            </div>
          </div>

          <div className="my-5 h-px bg-border" />

          <ul className="space-y-3">
            {RATINGS.map((r) => (
              <li key={r}>
                <button
                  onClick={() => toggleRating(r)}
                  className="flex w-full items-center gap-3 text-sm text-foreground"
                >
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded border transition-colors ${
                      ratings.includes(r)
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-surface-2"
                    }`}
                  >
                    {ratings.includes(r) && <Check className="h-3.5 w-3.5" />}
                  </span>
                  Clasificación {r}
                </button>
              </li>
            ))}
          </ul>

          <div className="mt-6 flex gap-3">
            <button className="btn-ghost flex-1" onClick={reset}>
              Cancelar
            </button>
            <button className="btn-primary flex-1" onClick={apply}>
              Filtrar
            </button>
          </div>
        </aside>

        {/* Grid de películas */}
        <section>
          <h1 className="mb-5 text-3xl tracking-wide">Cartelera de hoy</h1>
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {visible.map((m) => (
              <article
                key={m.id}
                className="card-surface group overflow-hidden transition-transform duration-200 hover:-translate-y-1"
              >
                <div className="relative aspect-[2/3] overflow-hidden">
                  <Image
                    src={m.poster}
                    alt={`Póster de ${m.title}`}
                    width={512}
                    height={768}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  <span className="absolute right-3 top-3 rounded-md bg-primary px-2 py-1 text-xs font-bold text-primary-foreground">
                    {m.rating}
                  </span>
                </div>
                <div className="p-4">
                  <h2 className="text-2xl tracking-wide">{m.title}</h2>
                  <p className="text-xs uppercase tracking-widest text-muted-foreground">
                    {m.genre}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {m.times.map((t) => (
                      <span key={t} className="chip">
                        {t}
                      </span>
                    ))}
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <Link
                      href={`/pelicula/${m.slug}`}
                      className="btn-primary px-4 py-2 text-xs normal-case tracking-normal"
                    >
                      Ver más...
                    </Link>
                    <span className="rounded-md border border-border bg-surface-2 px-2.5 py-1 text-xs font-bold text-secondary">
                      {m.rating}
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
          {visible.length === 0 && (
            <p className="mt-6 text-sm text-muted-foreground">
              No hay funciones que coincidan con los filtros seleccionados.
            </p>
          )}
        </section>
      </main>

      {/* Modal fecha */}
      <Modal
        open={dateOpen}
        title="Seleccionar una fecha para filtrar función"
        onClose={() => setDateOpen(false)}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setDateOpen(false)}>
              Cancelar
            </button>
            <button
              className="btn-primary"
              onClick={() => {
                setDate(`Día ${day} de septiembre`);
                setDateOpen(false);
              }}
            >
              OK
            </button>
          </>
        }
      >
        <p className="mb-3 text-center text-sm uppercase tracking-widest text-primary">
          Septiembre 2026
        </p>
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
          {["D", "L", "M", "M", "J", "V", "S"].map((d, i) => (
            <span key={i} className="py-1 font-semibold">
              {d}
            </span>
          ))}
          {Array.from({ length: 2 }, (_, i) => (
            <span key={`e${i}`} className="py-2 opacity-30">
              {30 + i}
            </span>
          ))}
          {Array.from({ length: 30 }, (_, i) => i + 1).map((d) => (
            <button
              key={d}
              onClick={() => setDay(d)}
              className={`rounded-md py-2 text-sm transition-colors ${
                d === day
                  ? "bg-primary font-semibold text-primary-foreground"
                  : "text-foreground hover:bg-surface-2"
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </Modal>

      {/* Modal horario */}
      <Modal
        open={slotOpen}
        title="Elegir un horario para filtrar función"
        onClose={() => setSlotOpen(false)}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setSlotOpen(false)}>
              Cancelar
            </button>
            <button className="btn-primary" onClick={() => setSlotOpen(false)}>
              OK
            </button>
          </>
        }
      >
        <div className="space-y-3">
          {SLOTS.map((s) => {
            const value = `${s.label} (${s.range})`;
            const active = slot === value;
            return (
              <button
                key={s.label}
                onClick={() => setSlot(value)}
                className={`w-full rounded-lg border px-4 py-3 text-left transition-colors ${
                  active
                    ? "border-primary bg-primary/10"
                    : "border-border bg-surface-2 hover:border-primary"
                }`}
              >
                <span className="block font-semibold">{s.label}</span>
                <span className="text-sm text-muted-foreground">{s.range}</span>
              </button>
            );
          })}
        </div>
      </Modal>

      {/* Modal idioma */}
      <Modal
        open={langOpen}
        title="Elegir un idioma para filtrar función"
        onClose={() => setLangOpen(false)}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setLangOpen(false)}>
              Cancelar
            </button>
            <button className="btn-primary" onClick={() => setLangOpen(false)}>
              OK
            </button>
          </>
        }
      >
        <div className="space-y-3">
          {LANGS.map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              className={`w-full rounded-lg border px-4 py-3 text-left transition-colors ${
                lang === l
                  ? "border-primary bg-primary/10"
                  : "border-border bg-surface-2 hover:border-primary"
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
}
