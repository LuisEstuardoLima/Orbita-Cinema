"use client";

import {
  useEffect,
  useState,
  useTransition,
  type FormEvent,
} from "react";
import {
  Percent,
  Save,
  Settings,
} from "lucide-react";

import { guardarPorcentajeRecargo } from "./actions";

export function AdminConfiguracionClient({
  porcentajeRecargo,
}: {
  porcentajeRecargo: number;
}) {
  const [valor, setValor] = useState(
    String(porcentajeRecargo),
  );

  const [pendiente, startTransition] =
    useTransition();

  const [error, setError] =
    useState<string | null>(null);

  const [mensaje, setMensaje] =
    useState<string | null>(null);

  /**
   * Los mensajes de éxito desaparecen
   * automáticamente después de 7 segundos.
   */
  useEffect(() => {
    if (!mensaje) return;

    const timer = setTimeout(
      () => setMensaje(null),
      7000,
    );

    return () =>
      clearTimeout(timer);
  }, [mensaje]);

  const validarCliente = (
    valorIngresado: string,
  ): string | null => {
    const limpio =
      valorIngresado.trim();

    if (!limpio) {
      return "El porcentaje de recargo es obligatorio.";
    }

    const numero =
      Number(limpio);

    if (!Number.isFinite(numero)) {
      return "El porcentaje de recargo debe ser un número válido.";
    }

    if (numero < 0) {
      return "El porcentaje de recargo no puede ser negativo.";
    }

    if (numero > 100) {
      return "El porcentaje de recargo no puede ser mayor que 100 %.";
    }

    if (
      Math.abs(
        numero * 100 -
          Math.round(numero * 100),
      ) >= 1e-9
    ) {
      return "El porcentaje puede tener como máximo 2 decimales.";
    }

    return null;
  };

  const handleSubmit = (
    e: FormEvent<HTMLFormElement>,
  ) => {
    e.preventDefault();

    setError(null);
    setMensaje(null);

    const validacion =
      validarCliente(valor);

    if (validacion) {
      setError(validacion);
      return;
    }

    const formData =
      new FormData(e.currentTarget);

    startTransition(async () => {
      const resultado =
        await guardarPorcentajeRecargo(
          formData,
        );

      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }

      setValor(
        String(
          resultado.porcentajeRecargo,
        ),
      );

      setMensaje(
        "Porcentaje de recargo actualizado correctamente.",
      );
    });
  };

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-3xl tracking-wide">
          Configuración
        </h1>

        <p className="mt-1 text-sm text-muted-foreground">
          Configura parámetros generales
          utilizados por el sistema.
        </p>
      </div>

      {mensaje && (
        <div
          role="status"
          className="rounded-md border border-primary/40 bg-primary/10 p-3 text-center text-sm text-green-600"
        >
          {mensaje}
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="rounded-md border border-destructive bg-destructive/10 p-3 text-center text-sm text-destructive"
        >
          {error}
        </div>
      )}

      <div className="card-surface overflow-hidden">
        <div className="flex items-center gap-3 border-b border-border px-6 py-5">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Settings className="h-5 w-5" />
          </span>

          <div>
            <h2 className="text-xl font-semibold">
              Configuración de compras
            </h2>

            <p className="mt-1 text-sm text-muted-foreground">
              Parámetros aplicados durante
              el proceso de compra de entradas.
            </p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-6 p-6"
        >
          <div className="max-w-md">
            <label
              htmlFor="porcentajeRecargo"
              className="label"
            >
              Porcentaje de recargo
            </label>

            <div className="relative">
              <Percent className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

              <input
                id="porcentajeRecargo"
                name="porcentajeRecargo"
                type="number"
                inputMode="decimal"
                min={0}
                max={100}
                step="0.01"
                required
                value={valor}
                onChange={(e) => {
                  setValor(
                    e.target.value,
                  );

                  if (error) {
                    setError(null);
                  }

                  if (mensaje) {
                    setMensaje(null);
                  }
                }}
                className="field pl-9 pr-12"
                aria-describedby="recargo-ayuda"
              />

              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">
                %
              </span>
            </div>

            <p
              id="recargo-ayuda"
              className="mt-2 text-xs text-muted-foreground"
            >
              Este porcentaje se aplicará
              únicamente a las nuevas
              compras. Las compras anteriores
              conservarán el porcentaje con
              el que fueron realizadas.
            </p>
          </div>

          <div className="rounded-md border border-border bg-surface-2 p-4">
            <p className="text-sm text-muted-foreground">
              Recargo actualmente configurado
            </p>

            <p className="mt-1 text-2xl font-semibold text-primary">
              {Number(valor || 0).toFixed(
                2,
              )}
              %
            </p>
          </div>

          <div className="flex justify-end border-t border-border pt-5">
            <button
              type="submit"
              className="btn-primary flex items-center gap-2 disabled:opacity-50"
              disabled={pendiente}
            >
              <Save className="h-4 w-4" />

              {pendiente
                ? "Guardando…"
                : "Guardar cambios"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}