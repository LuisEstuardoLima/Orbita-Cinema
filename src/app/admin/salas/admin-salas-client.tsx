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
import { Armchair, Pencil, Plus, Search, Tag } from "lucide-react";
import Link from "next/link";

import { Modal } from "@/components/cinema/Modal";
import { Switch } from "@/components/ui/switch";
import type { SalaAdmin } from "@/lib/db/salas";
import { TIPOS_ENTRADA } from "@/lib/entradas";
import {
  activarSala,
  crearSala,
  desactivarSala,
  editarSala,
  guardarPreciosSala,
} from "./actions";

type FiltroEstado = "" | "activas" | "inactivas";

// ⚠️ Lista duplicada: la misma está en `actions.ts` (allí se valida). Si se agrega o cambia un
// tipo, actualizar las dos. Pendiente unificarla en un módulo compartido.
const TIPOS_SALA = [
  "TRADICIONAL 2D",
  "TRADICIONAL 3D",
  "IMAX 2D",
  "IMAX 3D",
  "MACRO XE 2D",
  "MACRO XE 3D",
  "VIP 2D",
  "VIP 3D",
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
  soloLectura = false,
}: {
  salas: SalaAdmin[];
  /** Colaborador (SCRUM-116): ve las salas pero no puede crearlas, editarlas ni cambiar su estado. */
  soloLectura?: boolean;
}) {
  const [formulario, setFormulario] =
    useState<SalaAdmin | "nueva" | null>(null);

  const [aDesactivar, setADesactivar] =
    useState<SalaAdmin | null>(null);

  // SCRUM-121: sala cuyo modal de precios está abierto.
  const [enPrecios, setEnPrecios] =
    useState<SalaAdmin | null>(null);

  const [errorPrecios, setErrorPrecios] =
    useState<string | null>(null);

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

  const cerrarPrecios = () => {
    setEnPrecios(null);
    setErrorPrecios(null);
  };

  /** SCRUM-121: guardar precios. El servidor repite la validación y exige Administrador. */
  const onSubmitPrecios = (
    e: FormEvent<HTMLFormElement>,
  ) => {
    e.preventDefault();

    if (!enPrecios) return;

    const { id, nombre } = enPrecios;
    const datos = new FormData(e.currentTarget);

    setErrorPrecios(null);

    startTransition(async () => {
      const res = await guardarPreciosSala(id, datos);

      if (res.ok) {
        cerrarPrecios();

        setMensaje({
          texto: `Los precios de "${nombre}" se guardaron correctamente.`,
          ok: true,
        });
      } else {
        setErrorPrecios(res.error);
      }
    });
  };

  /**
   * Activar es directo y sin confirmar: la sala ya está a la vista en el panel
   * (mismo criterio que el interruptor de películas). El servidor vuelve a
   * validar el límite de 10 salas activas.
   */
  const activar = (sala: SalaAdmin) => {
    setMensaje(null);

    startTransition(async () => {
      const res = await activarSala(sala.id);

      setMensaje(
        res.ok
          ? {
              texto: `"${sala.nombre}" fue activada correctamente.`,
              ok: true,
            }
          : {
              texto: res.error,
              ok: false,
            },
      );
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

          {!soloLectura && (
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
          )}
        </div>

        {soloLectura && (
          <p
            role="note"
            className="mx-6 mb-4 rounded-md border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground"
          >
            Modo consulta: tu rol (Colaborador) puede ver esta información, pero no crearla ni modificarla.
          </p>
        )}

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

                <th className="px-4 py-3">
                  Asientos
                </th>

                <th className="px-4 py-3">
                  Precios
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
                    {!sala.capacidad ? (
                      <span className="inline-flex items-center rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-xs font-semibold text-amber-600">
                        Sin asientos configurados
                      </span>
                    ) : (
                      sala.capacidad
                    )}
                  </td>

                  {/* Estado: interruptor como en películas — encender activa directo
                      (sin confirmar); apagar abre el modal de desactivación. */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <Switch
                        checked={sala.activa}
                        disabled={pendiente || soloLectura}
                        onCheckedChange={(v) => (v ? activar(sala) : setADesactivar(sala))}
                        id={`activa-${sala.id}`}
                      />
                      <label
                        htmlFor={`activa-${sala.id}`}
                        className="cursor-pointer text-xs font-medium text-muted-foreground"
                      >
                        {sala.activa ? "Activa" : "Inactiva"}
                      </label>
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    {soloLectura ? (
                      <span className="text-xs text-muted-foreground">Solo consulta</span>
                    ) : (
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
                    )}
                  </td>

                  {/* SCRUM-110: acceso a la configuración de asientos de la sala. */}
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/salas/${sala.id}/asientos`}
                      className="btn-ghost text-primary hover:border-primary hover:text-primary"
                      title={soloLectura ? "Ver los asientos de la sala" : "Configurar los asientos de la sala"}
                    >
                      <Armchair className="h-4 w-4" />
                      {soloLectura ? "Ver asientos" : "Asientos"}
                    </Link>
                  </td>

                  {/* SCRUM-121: precios por tipo de entrada (consulta para el Colaborador). */}
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      className="btn-ghost text-primary hover:border-primary hover:text-primary"
                      title={soloLectura ? "Ver los precios de la sala" : "Editar los precios de la sala"}
                      onClick={() => {
                        setMensaje(null);
                        setErrorPrecios(null);
                        setEnPrecios(sala);
                      }}
                      disabled={pendiente}
                    >
                      <Tag className="h-4 w-4" />
                      {soloLectura ? "Ver precios" : "Precios"}
                    </button>
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

          <div>
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

              <p className="mt-1 text-xs text-muted-foreground">
                La capacidad se calcula sola al guardar la distribución del plano
                de asientos. Una sala nueva queda en 0 (sin asientos
                configurados) hasta ese momento.
              </p>
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

      {/* SCRUM-121: precios de la sala. Mismo estilo que "Editar sala"; en modo consulta
          (Colaborador) los campos van deshabilitados y solo queda el botón Cerrar. */}
      <Modal
        open={!!enPrecios}
        wide
        title={`Precios · ${enPrecios?.nombre ?? ""}`}
        onClose={cerrarPrecios}
        footer={
          soloLectura ? (
            <button
              type="button"
              className="btn-ghost"
              onClick={cerrarPrecios}
            >
              Cerrar
            </button>
          ) : (
            <>
              <button
                type="button"
                className="btn-ghost"
                onClick={cerrarPrecios}
                disabled={pendiente}
              >
                Cancelar
              </button>

              <button
                type="submit"
                form="form-precios"
                className="btn-primary"
                disabled={pendiente}
              >
                {pendiente
                  ? "Guardando..."
                  : "Guardar cambios"}
              </button>
            </>
          )
        }
      >
        <form
          key={enPrecios?.id ?? "ninguna"}
          id="form-precios"
          onSubmit={onSubmitPrecios}
          className="space-y-4"
        >
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            Tipo de sala
            <span className="rounded-md bg-primary/15 px-2 py-1 text-xs font-bold text-primary">
              {enPrecios?.tipo || "—"}
            </span>
          </p>

          <div className="grid gap-4 sm:grid-cols-3">
            {TIPOS_ENTRADA.map((t) => {
              const valor = enPrecios?.precios[t.id];

              return (
                <div key={t.id}>
                  <label
                    className="label"
                    htmlFor={`precio-${t.id}`}
                  >
                    {t.nombre} (Q)
                  </label>

                  <input
                    id={`precio-${t.id}`}
                    name={t.id}
                    type="number"
                    inputMode="decimal"
                    className="field"
                    required
                    min={0.01}
                    max={999.99}
                    step={0.01}
                    placeholder="0.00"
                    disabled={soloLectura}
                    defaultValue={
                      valor == null ? "" : valor.toFixed(2)
                    }
                  />

                  <p className="mt-1 text-xs text-muted-foreground">
                    {t.rangoEdad}
                  </p>
                </div>
              );
            })}
          </div>

          {errorPrecios && (
            <p
              role="alert"
              className="text-sm text-destructive"
            >
              {errorPrecios}
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
          Sus funciones programadas dejarán de mostrarse en la cartelera mientras
          la sala esté desactivada.
        </p>
      </Modal>
    </>
  );
}