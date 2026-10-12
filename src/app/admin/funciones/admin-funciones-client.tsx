"use client";

/**
 * Gestión de funciones — la parte que corre en el NAVEGADOR (SCRUM-111).
 *
 * Recibe las funciones desde hoy (activas y canceladas) y las opciones del formulario. Los
 * filtros por fecha, película y estado son locales, como el buscador de `/admin/peliculas`. Para guardar
 * llama a las Server Actions de `./actions`, que repiten todas las validaciones en el servidor.
 *
 * Se muestra dentro del layout común del panel (SCRUM-112), que ya pone encabezado y menú.
 */
import { useState, useTransition, type FormEvent } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Ban, CalendarDays, Clock, Pencil, Plus } from "lucide-react";
import { Modal } from "@/components/cinema/Modal";
import { Calendar } from "@/components/ui/calendar";
import type { TimepickerOptions } from "timepicker-ui";
import { Timepicker } from "timepicker-ui-react";
import "timepicker-ui/main.css";
import "timepicker-ui/theme-dark.css";
import { IDIOMAS_FILTRO, idiomaGrupo } from "@/lib/cartelera";
import type { FuncionAdmin, OpcionPelicula, OpcionSala } from "@/lib/db/funciones";
import { parseFecha, toFecha } from "@/lib/fechas";
import { cancelarFuncion, crearFuncion, editarFuncion } from "./actions";

/** Filtro de la columna Estado: "" = Todas. "Finalizada" se calcula en el navegador. */
type FiltroEstado = "" | "activas" | "canceladas" | "finalizadas";

const fechaCorta = (fecha: string) => format(parseFecha(fecha), "dd/MM/yyyy");

/**
 * Reloj emergente del campo Hora (timepicker-ui): minutos solo de 5 en 5 y
 * formato 12h. El tema "dark" se repinta con la paleta del proyecto en `globals.css`.
 */
const OPCIONES_TIMEPICKER: TimepickerOptions = {
  clock: { type: "12h", incrementMinutes: 5, autoSwitchToMinutes: true },
  ui: { theme: "dark", editable: false },
  labels: { time: "Elegir hora", ok: "Aceptar", cancel: "Cancelar", am: "AM", pm: "PM" },
};

/** "14:30" (lo que guarda la base) → "02:30 PM" (lo que muestra el input de 12h). */
const aFormato12 = (hora: string) => {
  const [hh, mm] = hora.split(":");
  const n = Number(hh);
  return `${String(n % 12 === 0 ? 12 : n % 12).padStart(2, "0")}:${mm} ${n < 12 ? "AM" : "PM"}`;
};

/** El dato confirmado por el reloj (hour, minutes, type) → "14:30" para la base. */
const aFormato24 = (hour?: string, minutes?: string, type?: string) => {
  if (!hour || !minutes) return "";
  const ampm = (type ?? "AM").trim();
  let h = Number(hour);
  if (ampm === "PM" && h !== 12) h += 12;
  if (ampm === "AM" && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${String(Number(minutes)).padStart(2, "0")}`;
};

/**
 * true si la función (fecha + hora) ya empezó, en hora de Guatemala.
 * "Finalizada" NO se guarda en la base: se calcula aquí para no tener que
 * recorrer filas actualizando estados cada minuto.
 */
const yaFinalizo = (fecha: string, hora: string, hoy: string, horaAhora: string) =>
  fecha < hoy || (fecha === hoy && hora.slice(0, 5) <= horaAhora.slice(0, 5));

/** Idioma a preseleccionar al editar: "Español Latino" -> "Español", para guardarlo normalizado. */
const idiomaFormulario = (idioma: string) => {
  const grupo = idiomaGrupo(idioma);
  return (IDIOMAS_FILTRO as readonly string[]).includes(grupo) ? grupo : IDIOMAS_FILTRO[0];
};

export function AdminFuncionesClient({
  hoy,
  funciones,
  peliculas,
  salas,
}: {
  hoy: string;
  funciones: FuncionAdmin[];
  peliculas: OpcionPelicula[];
  salas: OpcionSala[];
}) {
  // null = formulario cerrado; "nueva" = crear; una función = editar esa.
  const [formulario, setFormulario] = useState<FuncionAdmin | "nueva" | null>(null);
  const [aCancelar, setACancelar] = useState<FuncionAdmin | null>(null);
  const [filtroFecha, setFiltroFecha] = useState("");
  const [filtroPelicula, setFiltroPelicula] = useState("");
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>("");
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<{ texto: string; ok: boolean } | null>(null);
  const [pendiente, startTransition] = useTransition();
  // Película elegida en el formulario (para mostrar su duración). null = sin tocar.
  const [peliculaElegida, setPeliculaElegida] = useState<string | null>(null);
  // Calendario estilo cartelera: "filtro" filtra el listado; "form" es la fecha de la función.
  const [calendario, setCalendario] = useState<"filtro" | "form" | null>(null);
  const [fechaTmp, setFechaTmp] = useState("");
  const [fechaForm, setFechaForm] = useState("");
  // Hora del formulario en 24h ("HH:MM"), armada por los dos selects de hora y minutos.
  const [horaForm, setHoraForm] = useState("");

  const editando = formulario && formulario !== "nueva" ? formulario : null;

  // Hora actual de Guatemala (el servidor la pasa como `hoy`; la hora se deriva aquí).
  const ahoraGT = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString().slice(11, 16);

  const estadoDe = (f: FuncionAdmin): "activa" | "cancelada" | "finalizada" =>
    !f.activa ? "cancelada" : yaFinalizo(f.fecha, f.hora, hoy, ahoraGT) ? "finalizada" : "activa";

  const filtradas = funciones.filter((f) => {
    if (filtroFecha && f.fecha !== filtroFecha) return false;
    if (filtroPelicula && String(f.idPelicula) !== filtroPelicula) return false;
    if (!filtroEstado) return true;
    const estado = estadoDe(f);
    return filtroEstado === "activas"
      ? estado === "activa"
      : filtroEstado === "canceladas"
        ? estado === "cancelada"
        : estado === "finalizada";
  });

  // Para el filtro: todas las películas que tienen funciones listadas (aunque ya estén inactivas).
  const peliculasListadas = [
    ...new Map(
      funciones.filter((f) => f.idPelicula != null).map((f) => [f.idPelicula, f.pelicula]),
    ),
  ].sort((a, b) => a[1].localeCompare(b[1]));

  const cerrarFormulario = () => {
    setFormulario(null);
    setPeliculaElegida(null);
    setFechaForm("");
    setHoraForm("");
    setError(null);
  };

  /** Abre el calendario compacto (el mismo `Calendar` de la cartelera) para filtrar o para el form. */
  const abrirCalendario = (destino: "filtro" | "form", actual: string) => {
    setFechaTmp(actual || hoy);
    setCalendario(destino);
  };

  const confirmarCalendario = () => {
    if (fechaTmp) {
      if (calendario === "filtro") setFiltroFecha(fechaTmp);
      else setFechaForm(fechaTmp);
    }
    setCalendario(null);
  };

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!horaForm) {
      setError("Elige una hora para la función.");
      return;
    }
    const datos = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const res = editando ? await editarFuncion(editando.id, datos) : await crearFuncion(datos);
      if (res.ok) {
        cerrarFormulario();
        setMensaje({
          texto: editando
            ? "Función modificada correctamente."
            : "Función registrada correctamente.",
          ok: true,
        });
      } else {
        setError(res.error);
      }
    });
  };

  const confirmarCancelacion = () => {
    if (!aCancelar) return;
    const { id, pelicula, fecha, hora } = aCancelar;
    setACancelar(null);
    startTransition(async () => {
      const res = await cancelarFuncion(id);
      setMensaje(
        res.ok
          ? {
              texto: `La función de "${pelicula}" del ${fechaCorta(fecha)} a las ${hora} se canceló.`,
              ok: true,
            }
          : { texto: res.error, ok: false },
      );
    });
  };

  return (
    <>
      {/* El encabezado y el menú del panel viven en `admin/layout.tsx` (SCRUM-112). */}
      <section className="card-surface overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h1 className="text-3xl tracking-wide">Gestión de funciones</h1>
        </div>

        <div className="flex flex-wrap items-end justify-between gap-4 px-6 py-5">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="label" htmlFor="filtro-fecha">
                Fecha
              </label>
              <button
                id="filtro-fecha"
                type="button"
                className="field inline-flex cursor-pointer items-center gap-2 text-left"
                onClick={() => abrirCalendario("filtro", filtroFecha)}
              >
                <CalendarDays className="h-4 w-4 text-primary" />
                {filtroFecha ? fechaCorta(filtroFecha) : "Todas las fechas"}
              </button>
            </div>
            <div>
              <label className="label" htmlFor="filtro-pelicula">
                Película
              </label>
              <select
                id="filtro-pelicula"
                className="field"
                value={filtroPelicula}
                onChange={(e) => setFiltroPelicula(e.target.value)}
              >
                <option value="">Todas las películas</option>
                {peliculasListadas.map(([id, titulo]) => (
                  <option key={id} value={String(id)}>
                    {titulo}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="filtro-estado">
                Estado
              </label>
              <select
                id="filtro-estado"
                className="field"
                value={filtroEstado}
                onChange={(e) => setFiltroEstado(e.target.value as FiltroEstado)}
              >
                <option value="">Todas</option>
                <option value="activas">Activas</option>
                <option value="canceladas">Canceladas</option>
                <option value="finalizadas">Finalizadas</option>
              </select>
            </div>
            {(filtroFecha || filtroPelicula || filtroEstado) && (
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  setFiltroFecha("");
                  setFiltroPelicula("");
                  setFiltroEstado("");
                }}
              >
                Quitar filtros
              </button>
            )}
          </div>
          <button
            className="btn-primary"
            onClick={() => {
              setMensaje(null);
              setFechaForm(hoy);
              setHoraForm("");
              setFormulario("nueva");
            }}
          >
            <Plus className="h-4 w-4" /> Nueva función
          </button>
        </div>

        {mensaje && (
          <p
            role="status"
            className={`mx-6 mb-4 rounded-md border px-4 py-2 text-sm ${
              mensaje.ok
                ? "border-border bg-surface-2 text-secondary"
                : "border-destructive/50 bg-destructive/10 text-destructive"
            }`}
          >
            {mensaje.texto}
          </p>
        )}

        <div className="overflow-x-auto px-6 pb-6">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-surface-2 text-left uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3">Película</th>
                <th className="px-4 py-3">Sala</th>
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Hora</th>
                <th className="px-4 py-3">Idioma</th>
                <th className="px-4 py-3">Subtítulos</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((f) => (
                <tr
                  key={f.id}
                  className={`border-b border-border transition-colors hover:bg-surface-2/60 ${
                    f.activa ? "" : "opacity-60"
                  }`}
                >
                  <td className="px-4 py-3 font-semibold">{f.pelicula}</td>
                  <td className="px-4 py-3">{f.sala}</td>
                  <td className="px-4 py-3">{fechaCorta(f.fecha)}</td>
                  <td className="px-4 py-3">{f.hora}</td>
                  <td className="px-4 py-3 text-muted-foreground">{f.idioma || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{f.subtitulos ? "Sí" : "No"}</td>
                  <td className="px-4 py-3 text-xs font-medium text-muted-foreground">
                    {estadoDe(f) === "activa"
                      ? "Activa"
                      : estadoDe(f) === "finalizada"
                        ? "Finalizada"
                        : "Cancelada"}
                  </td>
                  <td className="px-4 py-3">
                    {estadoDe(f) === "activa" && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="btn-ghost text-primary hover:border-primary hover:text-primary"
                          onClick={() => {
                            setMensaje(null);
                            setFechaForm(f.fecha);
                            setHoraForm(f.hora);
                            setFormulario(f);
                          }}
                          disabled={pendiente}
                        >
                          <Pencil className="h-4 w-4" />
                          Editar
                        </button>
                        <button
                          type="button"
                          className="btn-ghost text-destructive hover:border-destructive hover:text-destructive"
                          onClick={() => setACancelar(f)}
                          disabled={pendiente}
                        >
                          <Ban className="h-4 w-4" />
                          Cancelar
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtradas.length === 0 && (
            <p className="px-4 py-6 text-sm text-muted-foreground">
              No hay funciones para mostrar.
            </p>
          )}
        </div>
      </section>

      {/* Nueva / editar función. `key` reinicia los valores por defecto al cambiar de función. */}
      <Modal
        open={formulario !== null}
        wide
        title={editando ? "Modificar función" : "Nueva función"}
        onClose={cerrarFormulario}
        footer={
          <>
            <button
              type="button"
              className="btn-ghost"
              onClick={cerrarFormulario}
              disabled={pendiente}
            >
              Cancelar
            </button>
            <button type="submit" form="form-funcion" className="btn-primary" disabled={pendiente}>
              {pendiente ? "Guardando..." : "Guardar"}
            </button>
          </>
        }
      >
        <form
          key={editando?.id ?? "nueva"}
          id="form-funcion"
          onSubmit={onSubmit}
          className="space-y-4"
        >
          <div>
            <label className="label" htmlFor="idPelicula">
              Película
            </label>
            <select
              id="idPelicula"
              name="idPelicula"
              className="field"
              required
              defaultValue={editando?.idPelicula != null ? String(editando.idPelicula) : ""}
              onChange={(e) => setPeliculaElegida(e.target.value)}
            >
              <option value="" disabled>
                Elige una película
              </option>
              {peliculas.map((p) => (
                <option key={p.id} value={String(p.id)}>
                  {p.titulo}
                </option>
              ))}
            </select>
            {(peliculaElegida ?? (editando ? String(editando.idPelicula) : "")) !== "" && (
              <p className="mt-1.5 text-xs text-muted-foreground">
                {(() => {
                  const sel = peliculas.find(
                    (p) =>
                      String(p.id) ===
                      (peliculaElegida ?? (editando ? String(editando.idPelicula) : "")),
                  );
                  return sel?.duracion != null
                    ? `Duración: ${sel.duracion} min (más 15 min de limpieza entre funciones).`
                    : "Esta película no tiene duración registrada.";
                })()}
              </p>
            )}
          </div>
          <div>
            <label className="label" htmlFor="idSala">
              Sala
            </label>
            <select
              id="idSala"
              name="idSala"
              className="field"
              required
              defaultValue={editando?.idSala != null ? String(editando.idSala) : ""}
            >
              <option value="" disabled>
                Elige una sala
              </option>
              {salas.map((s) => (
                <option key={s.id} value={String(s.id)}>
                  {s.tipo ? `${s.nombre} · ${s.tipo}` : s.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="fecha">
                Fecha
              </label>
              <button
                id="fecha"
                type="button"
                className="field inline-flex cursor-pointer items-center gap-2 text-left"
                onClick={() => abrirCalendario("form", fechaForm)}
              >
                <CalendarDays className="h-4 w-4 text-primary" />
                {fechaForm ? fechaCorta(fechaForm) : "Elegir fecha"}
              </button>
              <input type="hidden" name="fecha" value={fechaForm} readOnly />
            </div>
            <div>
              <label className="label" htmlFor="hora-timepicker">
                Hora
              </label>
              {/* Ancho fijo (no todo la celda) + ícono de reloj, como el de calendario en Fecha. */}
              <div className="relative w-52">
                <Timepicker
                  id="hora-timepicker"
                  className="field pr-10 cursor-pointer"
                  placeholder="Elegir hora"
                  required
                  defaultValue={horaForm ? aFormato12(horaForm) : ""}
                  options={OPCIONES_TIMEPICKER}
                  onConfirm={(data) => {
                    const nueva = aFormato24(data.hour, data.minutes, data.type);
                    if (nueva) setHoraForm(nueva);
                  }}
                />
                <Clock className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary" />
              </div>
              <input type="hidden" name="hora" value={horaForm} readOnly />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="idioma">
                Idioma
              </label>
              <select
                id="idioma"
                name="idioma"
                className="field"
                defaultValue={editando ? idiomaFormulario(editando.idioma) : IDIOMAS_FILTRO[0]}
              >
                {IDIOMAS_FILTRO.map((i) => (
                  <option key={i}>{i}</option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 self-end pb-2.5 text-sm">
              <input
                type="checkbox"
                name="subtitulos"
                defaultChecked={editando?.subtitulos ?? false}
                className="h-4 w-4 accent-[var(--primary)]"
              />
              Con subtítulos
            </label>
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </form>
      </Modal>

      {/* Cancelar función: baja lógica (`activa = false`), la función sale de la cartelera. */}
      <Modal
        open={!!aCancelar}
        title="Cancelar función"
        onClose={() => setACancelar(null)}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setACancelar(null)} disabled={pendiente}>
              Volver
            </button>
            <button className="btn-primary" onClick={confirmarCancelacion} disabled={pendiente}>
              {pendiente ? "Procesando..." : "Cancelar función"}
            </button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          La función de <span className="font-semibold text-foreground">{aCancelar?.pelicula}</span>{" "}
          en {aCancelar?.sala} del {aCancelar && fechaCorta(aCancelar.fecha)} a las{" "}
          {aCancelar?.hora} dejará de mostrarse en la cartelera. Esta acción no borra sus datos.
        </p>
      </Modal>

      {/* Calendario compacto: el mismo `Calendar` de la cartelera, en un modal del panel.
          Va al final del JSX para quedar encima de los otros modales. */}
      <Modal
        open={calendario !== null}
        title="Elegir fecha"
        onClose={() => setCalendario(null)}
        footer={
          <>
            {calendario === "filtro" && filtroFecha && (
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  setFiltroFecha("");
                  setCalendario(null);
                }}
              >
                Quitar fecha
              </button>
            )}
            <button type="button" className="btn-primary" onClick={confirmarCalendario}>
              OK
            </button>
          </>
        }
      >
        <div className="flex justify-center">
          <Calendar
            mode="single"
            locale={es}
            selected={fechaTmp ? parseFecha(fechaTmp) : undefined}
            onSelect={(d) => setFechaTmp(d ? toFecha(d) : fechaTmp)}
            defaultMonth={parseFecha(fechaTmp || hoy)}
            disabled={{ before: parseFecha(hoy) }}
          />
        </div>
      </Modal>
    </>
  );
}
