"use client";

/**
 * Gestión de funciones — la parte que corre en el NAVEGADOR (SCRUM-111).
 *
 * Recibe las funciones desde hoy (activas y canceladas) y las opciones del formulario. Los
 * filtros por fecha y película son locales, como el buscador de `/admin/peliculas`. Para guardar
 * llama a las Server Actions de `./actions`, que repiten todas las validaciones en el servidor.
 *
 * Se muestra dentro del layout común del panel (SCRUM-112), que ya pone encabezado y menú.
 */
import { useState, useTransition, type FormEvent } from "react";
import { format } from "date-fns";
import { Ban, Pencil, Plus } from "lucide-react";
import { Modal } from "@/components/cinema/Modal";
import { IDIOMAS_FILTRO, idiomaGrupo } from "@/lib/cartelera";
import type { FuncionAdmin, OpcionPelicula, OpcionSala } from "@/lib/db/funciones";
import { parseFecha } from "@/lib/fechas";
import { cancelarFuncion, crearFuncion, editarFuncion } from "./actions";

/** Filtro de la columna Estado: "" = Todas. */
type FiltroEstado = "" | "activas" | "canceladas";

const fechaCorta = (fecha: string) => format(parseFecha(fecha), "dd/MM/yyyy");

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

  const editando = formulario && formulario !== "nueva" ? formulario : null;

  const filtradas = funciones.filter(
    (f) =>
      (!filtroFecha || f.fecha === filtroFecha) &&
      (!filtroPelicula || String(f.idPelicula) === filtroPelicula) &&
      (!filtroEstado || f.activa === (filtroEstado === "activas")),
  );

  // Para el filtro: todas las películas que tienen funciones listadas (aunque ya estén inactivas).
  const peliculasListadas = [
    ...new Map(
      funciones.filter((f) => f.idPelicula != null).map((f) => [f.idPelicula, f.pelicula]),
    ),
  ].sort((a, b) => a[1].localeCompare(b[1]));

  const cerrarFormulario = () => {
    setFormulario(null);
    setError(null);
  };

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
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
              <input
                id="filtro-fecha"
                type="date"
                className="field"
                min={hoy}
                value={filtroFecha}
                onChange={(e) => setFiltroFecha(e.target.value)}
              />
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
                    {f.activa ? "Activa" : "Cancelada"}
                  </td>
                  <td className="px-4 py-3">
                    {f.activa && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="btn-ghost text-primary hover:border-primary hover:text-primary"
                          onClick={() => {
                            setMensaje(null);
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
              <input
                id="fecha"
                name="fecha"
                type="date"
                className="field"
                required
                min={hoy}
                defaultValue={editando?.fecha ?? ""}
              />
            </div>
            <div>
              <label className="label" htmlFor="hora">
                Hora
              </label>
              <input
                id="hora"
                name="hora"
                type="time"
                className="field"
                required
                defaultValue={editando?.hora ?? ""}
              />
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
    </>
  );
}
