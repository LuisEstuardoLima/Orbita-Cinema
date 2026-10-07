"use client";

/**
 * Cartelera — la parte que corre en el NAVEGADOR ("use client").
 *
 * Este archivo no habla con la base de datos: solo recibe los datos que ya trajo `page.tsx`
 * y maneja la interacción (filtros, búsqueda, elegir hora).
 *
 * La idea central del filtrado: hay dos listas de filtros.
 * - `draft`: lo que el usuario está escribiendo/eligiendo (puede no estar aplicado todavía).
 * - `applied`: lo que realmente está filtrando la cartelera en este momento.
 *
 * Los modales (fecha, horario, idioma) confirman con OK y mueven las dos listas a la vez
 * (`aplicar`). La búsqueda se muestra al instante mientras se escribe: filtra en memoria la
 * lista que ya trajo `page.tsx`, así que NO consulta la base por cada letra (no necesita
 * debounce). Enter o "Filtrar" la dejan aplicada en `applied` y en la URL. La clasificación
 * sigue aplicándose con el botón "Filtrar".
 *
 * La URL es la fuente de verdad: `sincronizarUrl` escribe los filtros aplicados en la barra de
 * direcciones con `replace` (no `push`, para no llenar el historial del botón "atrás"). Así, si
 * el usuario recarga, comparte el link o vuelve de una película, los filtros se conservan.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
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
  IDIOMAS_FILTRO,
  filtrosToParams,
  peliculasVisibles,
  rangoLabel,
  type Filtros,
  type IdiomaFiltro,
  type PeliculaVM,
} from "@/lib/cartelera";

import { parseFecha, toFecha } from "@/lib/fechas";

const MAX_CHIPS = 6;

const HORARIOS = [
  {
    nombre: "Horario Matinal",
    desde: "11:00",
    hasta: "12:00",
  },
  {
    nombre: "Horario Vespertino",
    desde: "13:00",
    hasta: "18:00",
  },
  {
    nombre: "Horario Nocturno",
    desde: "19:00",
    hasta: "23:00",
  },
] as const;

const mayus = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const fechaLarga = (fecha: string) =>
  mayus(format(parseFecha(fecha), "EEEE: dd 'de' MMMM", { locale: es }));

const fechaProxima = (fecha: string) =>
  mayus(format(parseFecha(fecha), "EEEE dd 'de' MMMM", { locale: es }));

export function CarteleraClient({
  peliculas,
  hoy,
  iniciales,
}: {
  peliculas: PeliculaVM[];
  hoy: string;
  iniciales: Filtros;
}) {
  const router = useRouter();

  const [draft, setDraft] = useState<Filtros>(iniciales);
  const [applied, setApplied] = useState<Filtros>(iniciales);

  const [dateOpen, setDateOpen] = useState(false);
  const [slotOpen, setSlotOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);

  const [tmpFecha, setTmpFecha] = useState<string | null>(null);
  const [tmpDesde, setTmpDesde] = useState("");
  const [tmpHasta, setTmpHasta] = useState("");
  const [tmpIdioma, setTmpIdioma] = useState<IdiomaFiltro>("");

  const [elegida, setElegida] = useState<number | null>(null);

  const alternarFuncion = (idFuncion: number) =>
    setElegida((prev) => (prev === idFuncion ? null : idFuncion));

  const urlActual = filtrosToParams(applied, hoy).toString();
  const urlRecibida = filtrosToParams(iniciales, hoy).toString();

  useEffect(() => {
    if (urlRecibida === urlActual) return;

    setDraft(iniciales);
    setApplied(iniciales);
  }, [urlRecibida, urlActual, iniciales]);

  // La búsqueda reacciona a cada tecla (`draft.query`); el resto de los filtros usa `applied`.
  // El filtrado es puro arreglo en memoria — los datos ya están en el navegador — así que no hay
  // consultas a la base ni esperas entre letras. El debounce solo sería necesario si al escribir
  // llamáramos a `sincronizarUrl` (router.replace recarga page.tsx, que sí consulta Supabase).
  const visibles = useMemo(
    () => peliculasVisibles(peliculas, { ...applied, query: draft.query }),
    [peliculas, applied, draft.query],
  );

  const diasConFuncion = useMemo(
    () =>
      [...new Set(peliculas.flatMap((p) => p.funciones.map((f) => f.fecha)))].map(
        parseFecha,
      ),
    [peliculas],
  );

  const set = <K extends keyof Filtros>(k: K, v: Filtros[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const sincronizarUrl = (f: Filtros) => {
    const q = filtrosToParams(f, hoy).toString();

    router.replace(q ? `/?${q}` : "/", { scroll: false });
  };

  const aplicar = (parche: Partial<Filtros>) => {
    const siguiente = { ...draft, ...parche };

    if (parche.fecha && parche.fecha !== applied.fecha) {
      setElegida(null);
    }

    setDraft(siguiente);
    setApplied(siguiente);
    sincronizarUrl(siguiente);
  };

  const toggleClasif = (r: string) =>
    set(
      "clasificaciones",
      draft.clasificaciones.includes(r)
        ? draft.clasificaciones.filter((x) => x !== r)
        : [...draft.clasificaciones, r],
    );

  const reset = () => {
    const base: Filtros = {
      ...FILTROS_VACIOS,
      fecha: hoy,
    };

    setDraft(base);
    setApplied(base);
    sincronizarUrl(base);
  };

  const abrirFecha = () => {
    setTmpFecha(draft.fecha ?? hoy);
    setDateOpen(true);
  };

  const abrirHorario = () => {
    setTmpDesde(draft.desde);
    setTmpHasta(draft.hasta);
    setSlotOpen(true);
  };

  const abrirIdioma = () => {
    setTmpIdioma(draft.idioma);
    setLangOpen(true);
  };

  const confirmarHorario = () => {
    aplicar({
      desde: tmpDesde,
      hasta: tmpHasta,
    });

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
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;

                setApplied(draft);
                sincronizarUrl(draft);
              }}
            />
          </div>

          <div className="my-5 h-px bg-border" />

          <div className="space-y-5">
            <div>
              <button className="btn-ghost w-full" onClick={abrirFecha}>
                <CalendarDays className="h-4 w-4" />
                Elegir fecha
              </button>

              <p className="mt-2 text-center text-sm text-muted-foreground">
                {fechaLarga(draft.fecha ?? hoy)}
              </p>
            </div>

            <div>
              <button className="btn-ghost w-full" onClick={abrirHorario}>
                <Clock className="h-4 w-4" />
                Elegir Horario
              </button>

              <p className="mt-2 text-center text-sm text-muted-foreground">
                {rangoLabel(draft.desde, draft.hasta)}
              </p>
            </div>

            <div>
              <button className="btn-ghost w-full" onClick={abrirIdioma}>
                <Languages className="h-4 w-4" />
                Elegir idioma
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
                    {draft.clasificaciones.includes(r) && (
                      <Check className="h-3.5 w-3.5" />
                    )}
                  </span>

                  Clasificación {r}
                </button>
              </li>
            ))}
          </ul>

          <div className="mt-6 flex gap-3">
            <button className="btn-ghost flex-1" onClick={reset}>
              Limpiar Filtros
            </button>

            <button
              className="btn-primary flex-1"
              onClick={() => {
                setApplied(draft);
                sincronizarUrl(draft);
              }}
            >
              Filtrar
            </button>
          </div>
        </aside>

        {/* Grid de películas */}
        <section>
          <h1 className="mb-5 text-3xl tracking-wide">
            {`Cartelera del ${fechaLarga(applied.fecha ?? hoy)}`}
          </h1>

          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {visibles.map(({ pelicula: m, funciones: todas }) => {
              const fechaVista = applied.fecha ?? hoy;

              const funciones = todas.filter(
                (f) => f.fecha === fechaVista,
              );

              const selId = elegida;

              const fnSel = elegida
                ? m.funciones.find((f) => f.id === elegida)
                : undefined;

              const detalle = fnSel
                ? `/pelicula/${m.slug}?fecha=${fnSel.fecha}&funcion=${fnSel.id}`
                : `/pelicula/${m.slug}?fecha=${fechaVista}`;

              const proxima = m.funciones.find(
                (f) => f.fecha >= fechaVista,
              );

              const sinFunciones =
                fechaVista === hoy
                  ? "Sin funciones hoy"
                  : `Sin funciones el ${fechaLarga(
                      fechaVista,
                    ).toLowerCase()}`;

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
                    <h2 className="text-2xl tracking-wide">
                      {m.titulo}
                    </h2>

                    <p className="text-xs uppercase tracking-widest text-muted-foreground">
                      {m.genero}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {funciones.length === 0 && (
                        <span className="text-xs text-muted-foreground">
                          {proxima
                            ? `${sinFunciones} · Próxima función: ${fechaProxima(
                                proxima.fecha,
                              )}`
                            : sinFunciones}
                        </span>
                      )}

                      {funciones.slice(0, MAX_CHIPS).map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => alternarFuncion(f.id)}
                          aria-pressed={selId === f.id}
                          aria-label={`Elegir función de las ${f.hora} en ${f.sala.nombre}`}
                          className={
                            selId === f.id
                              ? "chip chip-active"
                              : "chip"
                          }
                        >
                          {f.hora}
                        </button>
                      ))}

                      {funciones.length > MAX_CHIPS && (
                        <span className="chip">
                          +{funciones.length - MAX_CHIPS}
                        </span>
                      )}
                    </div>

                    <div className="mt-4 flex items-center justify-between">
                      <Link
                        href={detalle}
                        className="btn-primary px-4 py-2 text-xs normal-case tracking-normal"
                      >
                        {fnSel
                          ? `Ver más... (${fnSel.hora})`
                          : "Ver más..."}
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

      {/* Modal fecha */}
      <Modal
        open={dateOpen}
        title="Seleccionar una fecha para filtrar función"
        onClose={() => setDateOpen(false)}
        footer={
          <div className="flex w-full items-center justify-between gap-3">
            <button
              className="btn-ghost"
              onClick={() => {
                setTmpFecha(hoy);
                aplicar({ fecha: hoy });
                setDateOpen(false);
              }}
            >
              Hoy
            </button>

            <div className="flex gap-3">
              <button
                className="btn-ghost"
                onClick={() => setDateOpen(false)}
              >
                Cancelar
              </button>

              <button
                className="btn-primary"
                onClick={() => {
                  aplicar({ fecha: tmpFecha });
                  setDateOpen(false);
                }}
              >
                OK
              </button>
            </div>
          </div>
        }
      >
        <div className="flex justify-center">
          <Calendar
            mode="single"
            locale={es}
            selected={
              tmpFecha
                ? parseFecha(tmpFecha)
                : undefined
            }
            onSelect={(d) =>
              setTmpFecha(d ? toFecha(d) : hoy)
            }
            defaultMonth={parseFecha(tmpFecha ?? hoy)}
            disabled={{
              before: parseFecha(hoy),
            }}
            modifiers={{
              conFuncion: diasConFuncion,
            }}
            modifiersClassNames={{
              conFuncion: "font-bold text-primary",
            }}
          />
        </div>
      </Modal>

      {/* Modal horario */}
      <Modal
        open={slotOpen}
        title="Elegir un horario para filtrar función"
        onClose={() => setSlotOpen(false)}
        footer={
          <div className="flex w-full justify-end gap-3">
            <button
              className="btn-ghost"
              onClick={() => setSlotOpen(false)}
            >
              Cancelar
            </button>

            <button
              className="btn-primary"
              onClick={confirmarHorario}
            >
              OK
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          {HORARIOS.map((horario) => {
            const seleccionado =
              tmpDesde === horario.desde &&
              tmpHasta === horario.hasta;

            return (
              <button
                key={horario.nombre}
                type="button"
                onClick={() => {
                  setTmpDesde(horario.desde);
                  setTmpHasta(horario.hasta);
                }}
                aria-pressed={seleccionado}
                className={`w-full rounded-xl border px-5 py-3 text-left transition-all ${
                  seleccionado
                    ? "border-primary bg-primary/15 ring-1 ring-primary"
                    : "border-border bg-surface-2 hover:border-primary/70 hover:bg-primary/5"
                }`}
              >
                <span className="block font-semibold text-foreground">
                  {horario.nombre}
                </span>

                <span className="mt-0.5 block text-sm text-muted-foreground">
                  {horario.desde} - {horario.hasta}
                </span>
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
            <button
              className="btn-ghost"
              onClick={() => setLangOpen(false)}
            >
              Cancelar
            </button>

            <button
              className="btn-primary"
              onClick={() => {
                aplicar({ idioma: tmpIdioma });
                setLangOpen(false);
              }}
            >
              OK
            </button>
          </>
        }
      >
        <div className="space-y-3">
          {(["", ...IDIOMAS_FILTRO] as IdiomaFiltro[]).map(
            (l) => (
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
            ),
          )}
        </div>
      </Modal>
    </div>
  );
}