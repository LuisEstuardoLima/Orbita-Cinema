"use client";

import Image from "next/image";
import { useState } from "react";
import { CircleUserRound, Pencil, Plus, Search, Trash2, Upload } from "lucide-react";
import { Modal } from "@/components/cinema/Modal";
import { MOVIES } from "@/lib/cinema-data";

const NAV = ["Dashboard", "Películas", "Funciones", "Salas & asientos", "Reportes", "Usuarios"];

export function AdminPeliculasClient() {
  const [editing, setEditing] = useState<string | null>(null);
  const movie = MOVIES.find((m) => m.slug === editing);

  return (
    <div className="min-h-screen">
      <div className="mx-auto grid max-w-[1400px] gap-8 px-6 py-8 lg:grid-cols-[260px_1fr]">
        <aside className="card-surface h-fit overflow-hidden">
          <h2 className="border-b border-border px-5 py-4 text-2xl tracking-wide">
            Navegación
          </h2>
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
              <input className="field pl-9" placeholder="Buscar película..." />
            </div>
            <button className="btn-primary" onClick={() => setEditing("batman")}>
              <Plus className="h-4 w-4" /> Registrar nueva película
            </button>
          </div>

          <div className="overflow-x-auto px-6 pb-6">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-surface-2 text-left uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Poster</th>
                  <th className="px-4 py-3">Título</th>
                  <th className="px-4 py-3">Clasificación</th>
                  <th className="px-4 py-3">Género</th>
                  <th className="px-4 py-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {MOVIES.map((m) => (
                  <tr
                    key={m.id}
                    className="border-b border-border transition-colors hover:bg-surface-2/60"
                  >
                    <td className="px-4 py-3 text-muted-foreground">{m.id}</td>
                    <td className="px-4 py-3">
                      <Image
                        src={m.poster}
                        alt={`Póster de ${m.title}`}
                        width={512}
                        height={768}
                        className="h-14 w-10 rounded-md object-cover"
                      />
                    </td>
                    <td className="px-4 py-3 font-semibold">{m.title}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-md bg-primary/15 px-2 py-1 text-xs font-bold text-primary">
                        {m.rating}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{m.genre}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => setEditing(m.slug)}
                          aria-label={`Editar ${m.title}`}
                          className="rounded-md border border-border p-2 text-secondary transition-colors hover:border-primary hover:text-primary"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          aria-label={`Eliminar ${m.title}`}
                          className="rounded-md border border-border p-2 text-secondary transition-colors hover:border-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <Modal
        open={!!editing}
        wide
        title="Editar o agregar película"
        onClose={() => setEditing(null)}
        footer={
          <>
            <button className="btn-ghost" onClick={() => setEditing(null)}>
              Cancelar
            </button>
            <button className="btn-primary" onClick={() => setEditing(null)}>
              Guardar
            </button>
          </>
        }
      >
        <p className="mb-5 text-sm text-muted-foreground">
          Película: <span className="font-semibold text-primary">{movie?.title}</span>
        </p>
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-4">
            <div>
              <label className="label">Título</label>
              <input className="field" defaultValue={movie?.title} />
            </div>
            <div>
              <label className="label">Clasificación</label>
              <select className="field" defaultValue={movie?.rating}>
                {["A", "B", "B12", "B15", "C"].map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Género</label>
              <select className="field" defaultValue={movie?.genre}>
                {["Super-héroes", "Infantil", "Histórica", "Terror", "Comedia"].map((g) => (
                  <option key={g}>{g}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <label className="label">Poster</label>
              <button className="btn-light w-full">
                <Upload className="h-4 w-4" /> Elegir un archivo
              </button>
            </div>
            <div>
              <label className="label">Descripción</label>
              <textarea
                className="field h-[124px] resize-none"
                placeholder="Ingresar descripción..."
                defaultValue={movie?.synopsis}
              />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
