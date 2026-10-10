"use client";

/**
 * Panel de administración de películas — la parte que corre en el NAVEGADOR ("use client").
 *
 * Recibe la lista de películas (todas: activas y dadas de baja) y administra la pantalla.
 * Cuando necesita guardar algo, llama a las Server Actions de `./actions`; esas corren en el
 * servidor con la service role, que es la única forma de escribir en la base.
 *
 * Decisión de diseño del Sprint 1 (SCRUM-106): la baja nunca es un DELETE. El interruptor de la
 * columna Estado solo cambia `activa` (la película sigue en el panel para poder reactivarla) y el
 * botón Eliminar marca `eliminada = true` para que `listPeliculasAdmin()` la saque del listado;
 * en ambos casos los datos siguen intactos en la base. Ver la nota en `actions.ts` y en el README.
 *
 * SCRUM-108: el mismo formulario sirve para registrar y para editar (`editando` decide el modo).
 *
 * `useTransition` + `pendiente` sirven para deshabilitar la interfaz mientras el servidor responde.
 */
import { useState, useTransition, type ChangeEvent, type FormEvent } from "react";
import { Pencil, Plus, Search, Trash, Upload } from "lucide-react";
import { Modal } from "@/components/cinema/Modal";
import { PosterImage } from "@/components/cinema/PosterImage";
import { Switch } from "@/components/ui/switch";
import { CLASIFICACIONES, GENEROS } from "@/lib/cartelera";
import type { PeliculaRow } from "@/lib/db-types";
import { actualizarPelicula, cambiarEstadoPelicula, crearPelicula, eliminarPelicula } from "./actions";

/** Opciones de un <select>; si el valor guardado no está en la lista (dato antiguo) se conserva. */
const opciones = (lista: readonly string[], actual: string | null | undefined) =>
  actual && !lista.includes(actual) ? [actual, ...lista] : [...lista];

export function AdminPeliculasClient({ peliculas }: { peliculas: PeliculaRow[] }) {
  const [creando, setCreando] = useState(false);
  const [editando, setEditando] = useState<PeliculaRow | null>(null);
  const [aDesactivar, setADesactivar] = useState<PeliculaRow | null>(null);
  const [aEliminar, setAEliminar] = useState<PeliculaRow | null>(null);
  const [ocultas, setOcultas] = useState<number[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [archivo, setArchivo] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<{ texto: string; ok: boolean } | null>(null);
  const [pendiente, startTransition] = useTransition();

  // Ocultado instantáneo tras eliminar: el servidor ya excluye `eliminada` al listar, pero así
  // la fila desaparece sin esperar a la revalidación del listado.
  const filtradas = peliculas.filter(
    (p) =>
      !ocultas.includes(p.id) &&
      p.titulo.toLowerCase().includes(busqueda.trim().toLowerCase()),
  );

  // Cancelar, la X y guardar con éxito cierran por aquí. Cancelar no llama al servidor:
  // se vuelve al listado sin cambios (SCRUM-108, criterio 5).
  const cerrarFormulario = () => {
    setCreando(false);
    setEditando(null);
    setArchivo("");
    setError(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
  };

  // Solo se edita una película desactivada (SCRUM-108). El servidor lo vuelve a validar.
  const abrirEdicion = (p: PeliculaRow) => {
    if (p.activa) {
      setMensaje({ texto: "Desactiva la película para poder editarla.", ok: false });
      return;
    }
    setMensaje(null);
    setError(null);
    setEditando(p);
  };

  const onElegirPoster = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    setArchivo(f?.name ?? "");
    if (preview) URL.revokeObjectURL(preview);
    setPreview(f ? URL.createObjectURL(f) : null);
  };

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const datos = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const res = editando ? await actualizarPelicula(editando.id, datos) : await crearPelicula(datos);
      if (res.ok) {
        cerrarFormulario();
        setMensaje({
          texto: editando
            ? `Los cambios de "${editando.titulo}" se guardaron correctamente.`
            : "Película registrada correctamente.",
          ok: true,
        });
      } else {
        setError(res.error);
      }
    });
  };

  /** Activar es directo y sin confirmar: la película ya está a la vista en el panel. */
  const activar = (p: PeliculaRow) => {
    setMensaje(null);
    startTransition(async () => {
      const res = await cambiarEstadoPelicula(p.id, true);
      setMensaje(
        res.ok
          ? { texto: `"${p.titulo}" vuelve a mostrarse en la cartelera.`, ok: true }
          : { texto: res.error, ok: false },
      );
    });
  };

  /**
   * Eliminar (columna Acciones): marca `eliminada = true` (y `activa = false`) en la base y
   * oculta la fila del panel. No se borra nada: la película sigue existiendo en Supabase,
   * solo sale del listado del admin.
   */
  const confirmarEliminacion = () => {
    if (!aEliminar) return;
    const { id, titulo } = aEliminar;
    setAEliminar(null);
    startTransition(async () => {
      const res = await eliminarPelicula(id);
      if (res.ok) setOcultas((prev) => [...prev, id]);
      setMensaje(
        res.ok
          ? { texto: `"${titulo}" se eliminó del panel.`, ok: true }
          : { texto: res.error, ok: false },
      );
    });
  };

  const confirmarDesactivacion = () => {
    if (!aDesactivar) return;
    const { id, titulo } = aDesactivar;
    setADesactivar(null);
    startTransition(async () => {
      const res = await cambiarEstadoPelicula(id, false);
      setMensaje(
        res.ok
          ? { texto: `"${titulo}" dejó de mostrarse en la cartelera.`, ok: true }
          : { texto: res.error, ok: false },
      );
    });
  };

  return (
    <>
      {/* El encabezado y el menú del panel viven en `admin/layout.tsx` (SCRUM-112). */}
      <section className="card-surface overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h1 className="text-3xl tracking-wide">Gestión de películas</h1>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div className="relative w-full max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              className="field pl-9"
              placeholder="Buscar película..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
          <button className="btn-primary" onClick={() => setCreando(true)}>
            <Plus className="h-4 w-4" /> Registrar nueva película
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

        <p className="px-6 pb-3 text-xs text-muted-foreground">
          Para editar una película primero desactívala con el interruptor de Estado.
        </p>

        <div className="overflow-x-auto px-6 pb-6">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-surface-2 text-left uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">Poster</th>
                <th className="px-4 py-3">Título</th>
                <th className="px-4 py-3">Clasificación</th>
                <th className="px-4 py-3">Género</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map((m) => (
                <tr
                  key={m.id}
                  className={`border-b border-border transition-colors hover:bg-surface-2/60 ${
                    m.activa ? "" : "opacity-60"
                  }`}
                >
                  <td className="px-4 py-3 text-muted-foreground">
                    {String(m.id).padStart(2, "0")}
                  </td>
                  <td className="px-4 py-3">
                    <PosterImage
                      src={m.poster_url}
                      alt={`Póster de ${m.titulo}`}
                      className="h-14 w-10 rounded-md object-cover"
                    />
                  </td>
                  <td className="px-4 py-3 font-semibold">{m.titulo}</td>
                  <td className="px-4 py-3">
                    <span className="rounded-md bg-primary/15 px-2 py-1 text-xs font-bold text-primary">
                      {m.clasificacion}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{m.genero ?? "—"}</td>
                  {/* Estado (SCRUM-106): el interruptor cambia `activa` sin ocultar la fila;
                      para sacarla del listado está el botón Eliminar de la columna Acciones. */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <Switch
                        checked={m.activa}
                        disabled={pendiente}
                        onCheckedChange={(v) => (v ? activar(m) : setADesactivar(m))}
                        id={`activa-${m.id}`}
                      />
                      <label
                        htmlFor={`activa-${m.id}`}
                        className="cursor-pointer text-xs font-medium text-muted-foreground"
                      >
                        {m.activa ? "Activa" : "Inactiva"}
                      </label>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {/* Editar (SCRUM-108): solo con la película desactivada. El botón se ve igual
                          siempre; si está activa, `abrirEdicion` avisa en vez de abrir el formulario
                          y el servidor lo vuelve a validar. Mismo formato que "Registrar nueva película". */}
                      <button
                        type="button"
                        className="btn-primary"
                        title={m.activa ? "Desactiva la película para poder editarla" : undefined}
                        onClick={() => abrirEdicion(m)}
                        disabled={pendiente}
                      >
                        <Pencil className="h-4 w-4" />
                        Editar
                      </button>
                      <button
                        type="button"
                        className="btn-danger"
                        onClick={() => setAEliminar(m)}
                        disabled={pendiente}
                      >
                        <Trash className="h-4 w-4" />
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtradas.length === 0 && (
            <p className="px-4 py-6 text-sm text-muted-foreground">No hay películas para mostrar.</p>
          )}
        </div>
      </section>

      {/* Registrar (SCRUM-103) y editar (SCRUM-108) película: mismo formulario */}
      <Modal
        open={creando || !!editando}
        wide
        title={editando ? "Editar película" : "Registrar película"}
        onClose={cerrarFormulario}
        footer={
          <>
            <button type="button" className="btn-ghost" onClick={cerrarFormulario} disabled={pendiente}>
              Cancelar
            </button>
            <button type="submit" form="form-pelicula" className="btn-primary" disabled={pendiente}>
              {pendiente ? "Guardando..." : editando ? "Guardar cambios" : "Guardar"}
            </button>
          </>
        }
      >
        <form
          id="form-pelicula"
          onSubmit={onSubmit}
          className="grid gap-6 md:grid-cols-[180px_1fr]"
        >
          {/* Columna del póster: alta y estrecha, para que no descuadre los campos */}
          <div className="space-y-3">
            <label className="label">Póster</label>
            <label className="btn-light w-full cursor-pointer">
              <Upload className="h-4 w-4" /> {editando ? "Cambiar póster" : "Elegir archivo"}
              <input
                type="file"
                name="poster"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                onChange={onElegirPoster}
              />
            </label>
            {preview || editando?.poster_url ? (
              <>
                <PosterImage
                  src={preview ?? editando?.poster_url ?? null}
                  alt={preview ? "Vista previa del póster nuevo" : "Póster actual"}
                  className="aspect-[2/3] w-full rounded-md border border-border object-cover"
                />
                {editando && (
                  <p className="text-xs text-muted-foreground">
                    {preview ? "Vista previa: reemplazará al póster actual." : "Póster actual."}
                  </p>
                )}
              </>
            ) : (
              <div className="flex aspect-[2/3] w-full items-center justify-center rounded-md border border-dashed border-border text-xs text-muted-foreground">
                Sin imagen
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              JPG, PNG o WEBP · máximo 4 MB
              {archivo && <span className="mt-1 block truncate">{archivo}</span>}
            </p>
          </div>

          {/* Columna de datos: una sola columna para evitar huecos */}
          <div className="space-y-4">
            <div>
              <label className="label" htmlFor="titulo">Título</label>
              <input
                id="titulo"
                name="titulo"
                className="field"
                required
                maxLength={150}
                defaultValue={editando?.titulo ?? ""}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="clasificacion">Clasificación</label>
                <select
                  id="clasificacion"
                  name="clasificacion"
                  className="field"
                  required
                  defaultValue={editando?.clasificacion ?? "A"}
                >
                  <option value="">Selecciona una clasificación</option>
                  {opciones(CLASIFICACIONES, editando?.clasificacion).map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="genero">Género</label>
                <select
                  id="genero"
                  name="genero"
                  className="field"
                  defaultValue={editando?.genero ?? GENEROS[0]}
                >
                  {opciones(GENEROS, editando?.genero).map((g) => (
                    <option key={g}>{g}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="label" htmlFor="director">Director</label>
                <input
                  id="director"
                  name="director"
                  className="field"
                  maxLength={100}
                  defaultValue={editando?.director ?? ""}
                />
              </div>
              <div>
                <label className="label" htmlFor="actores">Actores</label>
                <input
                  id="actores"
                  name="actores"
                  className="field"
                  maxLength={100}
                  defaultValue={editando?.actores ?? editando?.actor_principal ?? ""}
                />
              </div>
              <div>
                <label className="label" htmlFor="estudio">Estudio</label>
                <input
                  id="estudio"
                  name="estudio"
                  className="field"
                  maxLength={100}
                  defaultValue={editando?.estudio ?? ""}
                />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="sinopsis">Descripción</label>
              <textarea
                id="sinopsis"
                name="sinopsis"
                required
                minLength={10}
                maxLength={2000}
                defaultValue={editando?.sinopsis ?? ""}
                className="field h-[124px] resize-none"
                placeholder="Ingresar descripción..."
              />
            </div>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>
        </form>
      </Modal>

      {/* Desactivar (SCRUM-106). Pide confirmación porque saca la película de la cartelera;
          activar no la pide, porque es la acción inversa y el mismo interruptor la hace. */}
      <Modal
        open={!!aDesactivar}
        title="Desactivar película"
        onClose={() => setADesactivar(null)}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setADesactivar(null)} disabled={pendiente}>
              Cancelar
            </button>
            <button className="btn-primary" onClick={confirmarDesactivacion} disabled={pendiente}>
              {pendiente ? "Procesando..." : "Desactivar"}
            </button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          Al desactivar <span className="font-semibold text-foreground">{aDesactivar?.titulo}</span>{" "}
          dejará de mostrarse en la cartelera. Seguirá visible en este panel y podrás volver a
          activarla cuando quieras. Esta acción no borra sus datos.
        </p>
      </Modal>

      {/* Eliminar (columna Acciones): marca `eliminada = true` (y `activa = false`) en la base;
          listPeliculasAdmin() filtra esas filas. La película no se borra, solo sale del panel. */}
      <Modal
        open={!!aEliminar}
        title="Eliminar película del panel"
        onClose={() => setAEliminar(null)}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setAEliminar(null)} disabled={pendiente}>
              Cancelar
            </button>
            <button className="btn-danger" onClick={confirmarEliminacion} disabled={pendiente}>
              {pendiente ? "Procesando..." : "Eliminar"}
            </button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{aEliminar?.titulo}</span> Esta acción
          eliminará la película del panel de administración y de la cartelera, además de todas sus
          funciones.
        </p>
      </Modal>
    </>
  );
}
