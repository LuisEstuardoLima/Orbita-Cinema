"use client";

/**
 * Gestión de salas — parte que corre en el navegador (SCRUM-109).
 *
 * Mantiene la misma estructura visual que el módulo de películas:
 * buscador, filtros, tabla administrativa y acciones destacadas.
 *
 * Las validaciones importantes se repiten en las Server Actions.
 */

import { useState, useTransition, type FormEvent } from "react";
import { Ban, Pencil, Plus, Search } from "lucide-react";

import { Modal } from "@/components/cinema/Modal";
import type { SalaAdmin } from "@/lib/db/salas";
import {
  crearSala,
  desactivarSala,
  editarSala,
} from "./actions";

type FiltroEstado = "" | "activas" | "inactivas";

const TIPOS_SALA = [
  "IMAX",
  "MACRO XE",
  "VIP",
  "TRADICIONAL",
] as const;

/**
 * Si existe un valor antiguo en Supabase que todavía no forma parte
 * de la lista oficial, lo conservamos temporalmente para poder editar
 * sin perder información.
 */
const opcionesTipo = (
  actual: string | null | undefined,
) =>
  actual &&
  !(TIPOS_SALA as readonly string[]).includes(actual)
    ? [actual, ...TIPOS_SALA]
    : [...TIPOS_SALA];

export function AdminSalasClient({
  salas,
}: {
  salas: SalaAdmin[];
}) {
  const [formulario, setFormulario] =
    useState<SalaAdmin | "nueva" | null>(null);

  const [aDesactivar, setADesactivar] =
    useState<SalaAdmin | null>(null);

  const [busqueda, setBusqueda] = useState("");

  const [filtroEstado, setFiltroEstado] =
    useState<FiltroEstado>("");

  const [error, setError] =
    useState<string | null>(null);

  const [mensaje, setMensaje] = useState<{
    texto: string;
    ok: boolean;
  } | null>(null);

  const [pendiente, startTransition] =
    useTransition();

  const editando =
    formulario && formulario !== "nueva"
      ? formulario
      : null;

  const salasActivas = salas.filter(
    (sala) => sala.activa,
  ).length;

  const filtradas = salas.filter((sala) => {
    const coincideBusqueda =
      sala.nombre
        .toLowerCase()
        .includes(busqueda.trim().toLowerCase()) ||
      sala.tipo
        .toLowerCase()
        .includes(busqueda.trim().toLowerCase());

    const coincideEstado =
      !filtroEstado ||
      sala.activa === (filtroEstado === "activas");

    return coincideBusqueda && coincideEstado;
  });

  const cerrarFormulario = () => {
    setFormulario(null);
    setError(null);
  };

  const onSubmit = (
    e: FormEvent<HTMLFormElement>,
  ) => {
    e.preventDefault();

    const datos = new FormData(e.currentTarget);

    setError(null);

    startTransition(async () => {
      const res = editando
        ? await editarSala(editando.id, datos)
        : await crearSala(datos);

      if (res.ok) {
        cerrarFormulario();

        setMensaje({
          texto: editando
            ? `Los cambios de "${editando.nombre}" se guardaron correctamente.`
            : "Sala registrada correctamente.",
          ok: true,
        });
      } else {
        setError(res.error);
      }
    });
  };

  const confirmarDesactivacion = () => {
    if (!aDesactivar) return;

    const { id, nombre } = aDesactivar;

    setADesactivar(null);

    startTransition(async () => {
      const res = await desactivarSala(id);

      setMensaje(
        res.ok
          ? {
              texto: `"${nombre}" fue desactivada correctamente.`,
              ok: true,
            }
          : {
              texto: res.error,
              ok: false,
            },
      );
    });
  };

  return (
    <>
      <section className="card-surface overflow-hidden">
        {/* Encabezado */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div>
            <h1 className="text-3xl tracking-wide">
              Gestión de salas
            </h1>

            <p className="mt-1 text-xs text-muted-foreground">
              Salas activas: {salasActivas} / 10
            </p>
          </div>
        </div>

        {/* Buscador, filtro y acción principal */}
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

              <input
                className="field pl-9"
                placeholder="Buscar sala..."
                value={busqueda}
                onChange={(e) =>
                  setBusqueda(e.target.value)
                }
              />
            </div>

            <select
              className="field w-auto min-w-[145px]"
              value={filtroEstado}
              onChange={(e) =>
                setFiltroEstado(
                  e.target.value as FiltroEstado,
                )
              }
            >
              <option value="">
                Todos los estados
              </option>

              <option value="activas">
                Activas
              </option>

              <option value="inactivas">
                Inactivas
              </option>
            </select>
          </div>

          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              setMensaje(null);
              setError(null);
              setFormulario("nueva");
            }}
            disabled={pendiente}
          >
            <Plus className="h-4 w-4" />
            Nueva sala
          </button>
        </div>

        {/* Mensajes */}
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
          Las salas desactivadas dejan de estar
          disponibles para programar funciones nuevas.
        </p>

        {/* Tabla */}
        <div className="overflow-x-auto px-6 pb-6">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-surface-2 text-left uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3">
                  ID
                </th>

                <th className="px-4 py-3">
                  Nombre
                </th>

                <th className="px-4 py-3">
                  Tipo
                </th>

                <th className="px-4 py-3">
                  Capacidad
                </th>

                <th className="px-4 py-3">
                  Estado
                </th>

                <th className="px-4 py-3">
                  Acciones
                </th>
              </tr>
            </thead>

            <tbody>
              {filtradas.map((sala) => (
                <tr
                  key={sala.id}
                  className={`border-b border-border transition-colors hover:bg-surface-2/60 ${
                    sala.activa
                      ? ""
                      : "opacity-60"
                  }`}
                >
                  <td className="px-4 py-3 text-muted-foreground">
                    {String(sala.id).padStart(
                      2,
                      "0",
                    )}
                  </td>

                  <td className="px-4 py-3 font-semibold">
                    {sala.nombre}
                  </td>

                  <td className="px-4 py-3">
                    <span className="rounded-md bg-primary/15 px-2 py-1 text-xs font-bold text-primary">
                      {sala.tipo || "—"}
                    </span>
                  </td>

                  <td className="px-4 py-3 text-muted-foreground">
                    {sala.capacidad}
                  </td>

                  <td className="px-4 py-3">
                    <span
                      className={`text-xs font-medium ${
                        sala.activa
                          ? "text-secondary"
                          : "text-muted-foreground"
                      }`}
                    >
                      {sala.activa
                        ? "Activa"
                        : "Inactiva"}
                    </span>
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() => {
                          setMensaje(null);
                          setError(null);
                          setFormulario(sala);
                        }}
                        disabled={pendiente}
                      >
                        <Pencil className="h-4 w-4" />
                        Editar
                      </button>

                      {sala.activa && (
                        <button
                          type="button"
                          className="btn-danger"
                          onClick={() =>
                            setADesactivar(sala)
                          }
                          disabled={pendiente}
                        >
                          <Ban className="h-4 w-4" />
                          Desactivar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filtradas.length === 0 && (
            <p className="px-4 py-6 text-sm text-muted-foreground">
              No hay salas para mostrar.
            </p>
          )}
        </div>
      </section>

      {/* Crear / editar sala */}
      <Modal
        open={formulario !== null}
        wide
        title={
          editando
            ? "Editar sala"
            : "Registrar sala"
        }
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

            <button
              type="submit"
              form="form-sala"
              className="btn-primary"
              disabled={pendiente}
            >
              {pendiente
                ? "Guardando..."
                : editando
                  ? "Guardar cambios"
                  : "Guardar"}
            </button>
          </>
        }
      >
        <form
          key={editando?.id ?? "nueva"}
          id="form-sala"
          onSubmit={onSubmit}
          className="space-y-4"
        >
          <div>
            <label
              className="label"
              htmlFor="nombre"
            >
              Nombre
            </label>

            <input
              id="nombre"
              name="nombre"
              type="text"
              className="field"
              required
              maxLength={100}
              placeholder="Ej. Sala 1"
              defaultValue={
                editando?.nombre ?? ""
              }
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                className="label"
                htmlFor="tipo"
              >
                Tipo
              </label>

              <select
                id="tipo"
                name="tipo"
                className="field"
                required
                defaultValue={
                  editando?.tipo ?? ""
                }
              >
                <option
                  value=""
                  disabled
                >
                  Selecciona un tipo
                </option>

                {opcionesTipo(
                  editando?.tipo,
                ).map((tipo) => (
                  <option
                    key={tipo}
                    value={tipo}
                  >
                    {tipo}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                className="label"
                htmlFor="capacidad"
              >
                Capacidad
              </label>

              <input
                id="capacidad"
                name="capacidad"
                type="number"
                inputMode="numeric"
                min={1}
                step={1}
                className="field"
                required
                placeholder="120"
                defaultValue={
                  editando?.capacidad ?? ""
                }
              />
            </div>
          </div>

          {error && (
            <p
              role="alert"
              className="text-sm text-destructive"
            >
              {error}
            </p>
          )}
        </form>
      </Modal>

      {/* Desactivar sala */}
      <Modal
        open={!!aDesactivar}
        title="Desactivar sala"
        onClose={() =>
          setADesactivar(null)
        }
        footer={
          <>
            <button
              type="button"
              className="btn-ghost"
              onClick={() =>
                setADesactivar(null)
              }
              disabled={pendiente}
            >
              Cancelar
            </button>

            <button
              type="button"
              className="btn-danger"
              onClick={
                confirmarDesactivacion
              }
              disabled={pendiente}
            >
              {pendiente
                ? "Procesando..."
                : "Desactivar"}
            </button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          Al desactivar{" "}
          <span className="font-semibold text-foreground">
            {aDesactivar?.nombre}
          </span>{" "}
          dejará de estar disponible para programar
          funciones nuevas.
        </p>

        <p className="mt-3 text-sm text-muted-foreground">
          La sala y sus funciones existentes no se
          eliminarán de la base de datos.
        </p>
      </Modal>
    </>
  );
}