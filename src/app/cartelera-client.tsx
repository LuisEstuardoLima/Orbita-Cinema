"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Search, CalendarDays, Clock, Languages, Check } from "lucide-react";
import { SiteHeader } from "@/components/cinema/SiteHeader";
import { Modal } from "@/components/cinema/Modal";
import { PosterImage } from "@/components/cinema/PosterImage";
import { Calendar } from "@/components/ui/calendar";
import {
  CLASIFICACIONES,
  FILTROS_VACIOS,
  HORAS,
  IDIOMAS_FILTRO,
  peliculasVisibles,
  rangoLabel,
  type Filtros,
  type IdiomaFiltro,
  type PeliculaVM,
} from "@/lib/cartelera";
import { parseFecha, toFecha } from "@/lib/fechas";

const MAX_CHIPS = 6;

const mayus = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const fechaLarga = (fecha: string) =>
  mayus(format(parseFecha(fecha), "EEEE: dd 'de' MMMM", { locale: es }));
const fechaCorta = (fecha: string) => format(parseFecha(fecha), "dd MMM", { locale: es });

export function CarteleraClient({ peliculas, hoy }: { peliculas: PeliculaVM[]; hoy: string }) {
  // "draft" = lo que se ve en el panel; "applied" = lo que se aplicó con el botón Filtrar
  const [draft, setDraft] = useState<Filtros>(FILTROS_VACIOS);
  const [applied, setApplied] = useState<Filtros>(FILTROS_VACIOS);

  const [dateOpen, setDateOpen] = useState(false);
  const [slotOpen, setSlotOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);

  // valores temporales de cada modal (se confirman con OK)
  const [tmpFecha, setTmpFecha] = useState<string | null>(null);
  const [tmpDesde, setTmpDesde] = useState("");
  const [tmpHasta, setTmpHasta] = useState("");
  const [tmpIdioma, setTmpIdioma] = useState<IdiomaFiltro>("");
  const [slotError, setSlotError] = useState("");

  const visibles = useMemo(() => peliculasVisibles(peliculas, applied), [peliculas, applied]);
  const diasConFuncion = useMemo(
    () => [...new Set(peliculas.flatMap((p) => p.funciones.map((f) => f.fecha)))].map(parseFecha),
    [peliculas],
  );

  const set = <K extends keyof Filtros>(k: K, v: Filtros[K]) => setDraft((d) => ({ ...d, [k]: v }));
  const toggleClasif = (r: string) =>
    set(
      "clasificaciones",
      draft.clasificaciones.includes(r)
        ? draft.clasificaciones.filter((x) => x !== r)
        : [...draft.clasificaciones, r],
    );

  const reset = () => {
    setDraft(FILTROS_VACIOS);
    setApplied(FILTROS_VACIOS);
  };

  const abrirFecha = () => {
    setTmpFecha(draft.fecha);
    setDateOpen(true);
  };
  const abrirHorario = () => {
    setTmpDesde(draft.desde);
    setTmpHasta(draft.hasta);
    setSlotError("");
    setSlotOpen(true);
  };
  const abrirIdioma = () => {
    setTmpIdioma(draft.idioma);
    setLangOpen(true);
  };

  const confirmarHorario = () => {
    if (tmpDesde && tmpHasta && tmpDesde > tmpHasta) {
      setSlotError("La hora inicial no puede ser mayor que la final.");
      return;
    }
    setDraft((d) => ({ ...d, desde: tmpDesde, hasta: tmpHasta }));
    setSlotOpen(false);
  };

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
              value={draft.query}
              onChange={(e) => set("query", e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && setApplied(draft)}
            />
          </div>

          <div className="my-5 h-px bg-border" />

          <div className="space-y-5">
            <div>
              <button className="btn-ghost w-full" onClick={abrirFecha}>
                <CalendarDays className="h-4 w-4" /> Elegir fecha
              </button>
              <p className="mt-2 text-center text-sm text-muted-foreground">
                {draft.fecha ? fechaLarga(draft.fecha) : "Todas las fechas"}
              </p>
            </div>
            <div>
              <button className="btn-ghost w-full" onClick={abrirHorario}>
                <Clock className="h-4 w-4" /> Elegir Horario
              </button>
              <p className="mt-2 text-center text-sm text-muted-foreground">
                {rangoLabel(draft.desde, draft.hasta)}
              </p>
            </div>
            <div>
              <button className="btn-ghost w-full" onClick={abrirIdioma}>
                <Languages className="h-4 w-4" /> Elegir idioma
              </button>
              <p className="mt-2 text-center text-sm text-muted-foreground">
                {draft.idioma || "Todos los idiomas"}
              </p>
            </div>
          </div>

          <div className="my-5 h-px bg-border" />

          <ul className="space-y-3">
            {CLASIFICACIONES.map((r) => (
              <li key={r}>
                <button
                  onClick={() => toggleClasif(r)}
                  className="flex w-full items-center gap-3 text-sm text-foreground"
                >
                  <span
                    className={`flex h-5 w-5 items-center justify-center rounded border transition-colors ${
                      draft.clasificaciones.includes(r)
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-surface-2"
                    }`}
                  >
                    {draft.clasificaciones.includes(r) && <Check className="h-3.5 w-3.5" />}
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
            <button className="btn-primary flex-1" onClick={() => setApplied(draft)}>
              Filtrar
            </button>
          </div>
        </aside>

        {/* Grid de películas */}
        <section>
          <h1 className="mb-5 text-3xl tracking-wide">
            {applied.fecha ? `Cartelera del ${fechaLarga(applied.fecha)}` : "Cartelera"}
          </h1>
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {visibles.map(({ pelicula: m, funciones }) => {
              const variasFechas = new Set(funciones.map((f) => f.fecha)).size > 1;
              return (
                <article
                  key={m.id}
                  className="card-surface group overflow-hidden transition-transform duration-200 hover:-translate-y-1"
                >
                  <div className="relative aspect-[2/3] overflow-hidden">
                    <PosterImage
                      src={m.posterUrl}
                      alt={`Póster de ${m.titulo}`}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                    <span className="absolute right-3 top-3 rounded-md bg-primary px-2 py-1 text-xs font-bold text-primary-foreground">
                      {m.clasificacion}
                    </span>
                  </div>
                  <div className="p-4">
                    <h2 className="text-2xl tracking-wide">{m.titulo}</h2>
                    <p className="text-xs uppercase tracking-widest text-muted-foreground">
                      {m.genero}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {funciones.length === 0 && (
                        <span className="text-xs text-muted-foreground">
                          Sin funciones programadas
                        </span>
                      )}
                      {funciones.slice(0, MAX_CHIPS).map((f) => (
                        <span key={f.id} className="chip">
                          {variasFechas ? `${fechaCorta(f.fecha)} · ${f.hora}` : f.hora}
                        </span>
                      ))}
                      {funciones.length > MAX_CHIPS && (
                        <span className="chip">+{funciones.length - MAX_CHIPS}</span>
                      )}
                    </div>
                    <div className="mt-4 flex items-center justify-between">
                      <Link
                        href={`/pelicula/${m.slug}${applied.fecha ? `?fecha=${applied.fecha}` : ""}`}
                        className="btn-primary px-4 py-2 text-xs normal-case tracking-normal"
                      >
                        Ver más...
                      </Link>
                      <span className="rounded-md border border-border bg-surface-2 px-2.5 py-1 text-xs font-bold text-secondary">
                        {m.clasificacion}
                      </span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
          {visibles.length === 0 && (
            <p className="mt-6 text-sm text-muted-foreground">
              No hay funciones que coincidan con los filtros seleccionados.
            </p>
          )}
        </section>
      </main>

      {/* Modal fecha: calendario tradicional (RF-067) */}
      <Modal
        open={dateOpen}
        title="Seleccionar una fecha para filtrar función"
        onClose={() => setDateOpen(false)}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setTmpFecha(null)}>
              Quitar fecha
            </button>
            <button className="btn-ghost" onClick={() => setDateOpen(false)}>
              Cancelar
            </button>
            <button
              className="btn-primary"
              onClick={() => {
                set("fecha", tmpFecha);
                setDateOpen(false);
              }}
            >
              OK
            </button>
          </>
        }
      >
        <div className="flex justify-center">
          <Calendar
            mode="single"
            locale={es}
            selected={tmpFecha ? parseFecha(tmpFecha) : undefined}
            onSelect={(d) => setTmpFecha(d ? toFecha(d) : null)}
            defaultMonth={parseFecha(tmpFecha ?? hoy)}
            disabled={{ before: parseFecha(hoy) }}
            modifiers={{ conFuncion: diasConFuncion }}
            modifiersClassNames={{ conFuncion: "font-bold text-primary" }}
          />
        </div>
      </Modal>

      {/* Modal horario: rango numérico directo, sin etiquetas (RF-068) */}
      <Modal
        open={slotOpen}
        title="Elegir un horario para filtrar función"
        onClose={() => setSlotOpen(false)}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setSlotOpen(false)}>
              Cancelar
            </button>
            <button className="btn-primary" onClick={confirmarHorario}>
              OK
            </button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Desde</label>
            <select className="field" value={tmpDesde} onChange={(e) => setTmpDesde(e.target.value)}>
              <option value="">Sin límite</option>
              {HORAS.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Hasta</label>
            <select className="field" value={tmpHasta} onChange={(e) => setTmpHasta(e.target.value)}>
              <option value="">Sin límite</option>
              {HORAS.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </select>
          </div>
        </div>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          {rangoLabel(tmpDesde, tmpHasta)}
        </p>
        {slotError && <p className="mt-2 text-center text-sm text-destructive">{slotError}</p>}
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
            <button
              className="btn-primary"
              onClick={() => {
                set("idioma", tmpIdioma);
                setLangOpen(false);
              }}
            >
              OK
            </button>
          </>
        }
      >
        <div className="space-y-3">
          {(["", ...IDIOMAS_FILTRO] as IdiomaFiltro[]).map((l) => (
            <button
              key={l || "todos"}
              onClick={() => setTmpIdioma(l)}
              className={`w-full rounded-lg border px-4 py-3 text-left transition-colors ${
                tmpIdioma === l
                  ? "border-primary bg-primary/10"
                  : "border-border bg-surface-2 hover:border-primary"
              }`}
            >
              {l || "Todos los idiomas"}
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
}
