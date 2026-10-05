"use client";

import { useState, useTransition, type ChangeEvent, type FormEvent } from "react";
import { CircleUserRound, Plus, Search, Upload } from "lucide-react";
import { Modal } from "@/components/cinema/Modal";
import { PosterImage } from "@/components/cinema/PosterImage";
import { Switch } from "@/components/ui/switch";
import { CLASIFICACIONES, GENEROS } from "@/lib/cartelera";
import type { PeliculaRow } from "@/lib/db-types";
import { cambiarEstadoPelicula, crearPelicula } from "./actions";

const NAV = ["Dashboard", "Películas", "Funciones", "Salas & asientos", "Reportes", "Usuarios"];

export function AdminPeliculasClient({ peliculas }: { peliculas: PeliculaRow[] }) {
  const [creando, setCreando] = useState(false);
  const [aDesactivar, setADesactivar] = useState<PeliculaRow | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [archivo, setArchivo] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<{ texto: string; ok: boolean } | null>(null);
  const [pendiente, startTransition] = useTransition();

  const filtradas = peliculas.filter((p) =>
    p.titulo.toLowerCase().includes(busqueda.trim().toLowerCase()),
  );

  const cerrarFormulario = () => {
    setCreando(false);
    setArchivo("");
    setError(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
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
      const res = await crearPelicula(datos);
      if (res.ok) {
        cerrarFormulario();
        setMensaje({ texto: "Película registrada correctamente.", ok: true });
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
    <div className="min-h-screen">
      <div className="mx-auto grid max-w-[1400px] gap-8 px-6 py-8 lg:grid-cols-[260px_1fr]">
        <aside className="card-surface h-fit overflow-hidden">
          <h2 className="border-b border-border px-5 py-4 text-2xl tracking-wide">Navegación</h2>
          <ul>
            {NAV.map((item) => (
              <li key={item}>
                <button
                  className={`w-full border-l-4 px-5 py-3 text-left text-sm transition-colors ${
                    item === "Películas"
                      ? "border-primary bg-surface-2 font-semibold text-primary"
                      : "border-transparent text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                  }`}
                >
                  {item}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section className="card-surface overflow-hidden">
          <div className="flex items-center justify-between border-b border-border px-6 py-4">
            <h1 className="text-3xl tracking-wide">Gestión de películas</h1>
            <span className="flex items-center gap-2 text-sm text-secondary">
              <CircleUserRound className="h-6 w-6" /> Usuario Id
            </span>
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
                    {/* Editar es del Sprint 7 (SCRUM-67). El interruptor sustituye al botón
                        de eliminar: la baja lógica siempre es reversible desde aquí. */}
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
                  </tr>
                ))}
              </tbody>
            </table>
            {filtradas.length === 0 && (
              <p className="px-4 py-6 text-sm text-muted-foreground">No hay películas para mostrar.</p>
            )}
          </div>
        </section>
      </div>

      {/* Registrar película (SCRUM-103) */}
      <Modal
        open={creando}
        wide
        title="Registrar película"
        onClose={cerrarFormulario}
        footer={
          <>
            <button type="button" className="btn-ghost" onClick={cerrarFormulario} disabled={pendiente}>
              Cancelar
            </button>
            <button type="submit" form="form-pelicula" className="btn-primary" disabled={pendiente}>
              {pendiente ? "Guardando..." : "Guardar"}
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
              <Upload className="h-4 w-4" /> Elegir archivo
              <input
                type="file"
                name="poster"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                onChange={onElegirPoster}
              />
            </label>
            {preview ? (
              <PosterImage
                src={preview}
                alt="Vista previa del póster"
                className="aspect-[2/3] w-full rounded-md border border-border object-cover"
              />
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
              <input id="titulo" name="titulo" className="field" required maxLength={150} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label" htmlFor="clasificacion">Clasificación</label>
                <select id="clasificacion" name="clasificacion" className="field" defaultValue="A">
                  {CLASIFICACIONES.map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="genero">Género</label>
                <select id="genero" name="genero" className="field" defaultValue={GENEROS[0]}>
                  {GENEROS.map((g) => (
                    <option key={g}>{g}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="label" htmlFor="director">Director</label>
                <input id="director" name="director" className="field" maxLength={100} />
              </div>
              <div>
                <label className="label" htmlFor="actores">Actores</label>
                <input id="actores" name="actores" className="field" maxLength={100} />
              </div>
              <div>
                <label className="label" htmlFor="estudio">Estudio</label>
                <input id="estudio" name="estudio" className="field" maxLength={100} />
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
    </div>
  );
}
