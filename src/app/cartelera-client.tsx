"use client";

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
  HORAS,
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

  // La URL es la fuente de verdad de los filtros: el servidor la lee al abrir la cartelera, así que
  // volver de una película, recargar o compartir el link conserva la selección.
  const [draft, setDraft] = useState<Filtros>(iniciales);
  const [applied, setApplied] = useState<Filtros>(iniciales);

  const [dateOpen, setDateOpen] = useState(false);
  const [slotOpen, setSlotOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);

  // valores temporales de cada modal (se confirman con OK)
  const [tmpFecha, setTmpFecha] = useState<string | null>(null);
  const [tmpDesde, setTmpDesde] = useState("");
  const [tmpHasta, setTmpHasta] = useState("");
  const [tmpIdioma, setTmpIdioma] = useState<IdiomaFiltro>("");
  const [slotError, setSlotError] = useState("");

  // Si la URL cambia desde afuera (logo, "Cartelera" del header, botón "atrás" del navegador), el
  // servidor manda otros filtros iniciales y hay que adoptarlos: useState solo corre en el primer
  // render. Se comparan las query strings para no pisar lo que el usuario escribe en el panel.
  const urlActual = filtrosToParams(applied, hoy).toString();
  const urlRecibida = filtrosToParams(iniciales, hoy).toString();
  useEffect(() => {
    if (urlRecibida === urlActual) return;
    setDraft(iniciales);
    setApplied(iniciales);
  }, [urlRecibida, urlActual, iniciales]);

  const visibles = useMemo(() => peliculasVisibles(peliculas, applied), [peliculas, applied]);
  const diasConFuncion = useMemo(
    () => [...new Set(peliculas.flatMap((p) => p.funciones.map((f) => f.fecha)))].map(parseFecha),
    [peliculas],
  );

  const set = <K extends keyof Filtros>(k: K, v: Filtros[K]) => setDraft((d) => ({ ...d, [k]: v }));

  // `replace` y no `push`: cambiar un filtro no debe llenar el historial de "atrás".
  const sincronizarUrl = (f: Filtros) => {
    const q = filtrosToParams(f, hoy).toString();
    router.replace(q ? `/?${q}` : "/", { scroll: false });
  };

  // Los modales filtran al confirmar con OK: se actualizan a la vez lo que se ve en el panel
  // (draft) y lo que realmente filtra la cartelera (applied), para no pedir un segundo clic.
  const aplicar = (parche: Partial<Filtros>) => {
    const siguiente = { ...draft, ...parche };
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
    const base: Filtros = { ...FILTROS_VACIOS, fecha: hoy };
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
    aplicar({ desde: tmpDesde, hasta: tmpHasta });
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
                <CalendarDays className="h-4 w-4" /> Elegir fecha
              </button>
              <p className="mt-2 text-center text-sm text-muted-foreground">
                {fechaLarga(draft.fecha ?? hoy)}
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
              // `todas` ya viene filtrada a la fecha activa. La próxima función se busca en la lista
              // completa de la película, porque esa lista no está recortada a un solo día.
              const fechaVista = applied.fecha ?? hoy;
              const funciones = todas.filter((f) => f.fecha === fechaVista);
              const proxima = m.funciones.find((f) => f.fecha >= fechaVista);
              const sinFunciones =
                fechaVista === hoy
                  ? "Sin funciones hoy"
                  : `Sin funciones el ${fechaLarga(fechaVista).toLowerCase()}`;
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
                          {proxima
                            ? `${sinFunciones} · Próxima función: ${fechaProxima(proxima.fecha)}`
                            : sinFunciones}
                        </span>
                      )}
                      {funciones.slice(0, MAX_CHIPS).map((f) => (
                        <span key={f.id} className="chip">
                          {f.hora}
                        </span>
                      ))}
                      {funciones.length > MAX_CHIPS && (
                        <span className="chip">+{funciones.length - MAX_CHIPS}</span>
                      )}
                    </div>
                    <div className="mt-4 flex items-center justify-between">
                      <Link
                        href={`/pelicula/${m.slug}?fecha=${applied.fecha ?? hoy}`}
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
              <button className="btn-ghost" onClick={() => setDateOpen(false)}>
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
            selected={tmpFecha ? parseFecha(tmpFecha) : undefined}
            onSelect={(d) => setTmpFecha(d ? toFecha(d) : hoy)}
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
          <div className="flex w-full items-center justify-between gap-3">
            <button
              className="btn-ghost"
              onClick={() => {
                setTmpDesde("");
                setTmpHasta("");
                setSlotError("");
                aplicar({ desde: "", hasta: "" });
                setSlotOpen(false);
              }}
            >
              Limpiar horario
            </button>
            <div className="flex gap-3">
              <button className="btn-ghost" onClick={() => setSlotOpen(false)}>
                Cancelar
              </button>
              <button className="btn-primary" onClick={confirmarHorario}>
                OK
              </button>
            </div>
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label">Desde</label>
            <select className="field" value={tmpDesde} onChange={(e) => setTmpDesde(e.target.value)}>
              <option value="">Cualquier hora</option>
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
              <option value="">Cualquier hora</option>
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
