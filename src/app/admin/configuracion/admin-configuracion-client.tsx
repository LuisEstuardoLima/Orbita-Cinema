"use client";

import {
  useState,
  useTransition,
  type FormEvent,
} from "react";
import {
  Percent,
  Save,
  Settings,
} from "lucide-react";

import { useTimedMessage } from "@/lib/use-timed-message";
import { guardarPorcentajeRecargo } from "./actions";

export function AdminConfiguracionClient({
  porcentajeRecargo,
}: {
  porcentajeRecargo: number;
}) {
  const formatearPorcentaje = (
    n: number,
  ): string => {
    const partes = n
      .toFixed(2)
      .replace(/\.00$/, "")
      .replace(/(\.\d*?[1-9])0+$/, "$1");
    return partes;
  };

  // `valorEditado` es lo que se escribe y se muestra en el input mientras se teclea.
  const [valorEditado, setValorEditado] = useState(
    formatearPorcentaje(porcentajeRecargo),
  );

  // `valorGuardado` es el último valor guardado con éxito; solo se actualiza tras
  // una respuesta positiva del servidor.
  const [valorGuardado, setValorGuardado] = useState(
    porcentajeRecargo,
  );

  const [pendiente, startTransition] =
    useTransition();

  const [errorCampo, setErrorCampo] =
    useState<string | null>(null);

  const { mensaje, setMensaje, clear } =
    useTimedMessage(8000);

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

    if (numero <= 0) {
      return "El porcentaje de recargo debe ser mayor que 0 %.";
    }

    if (numero >= 100) {
      return "El porcentaje de recargo debe ser menor que 100 %.";
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

    setErrorCampo(null);
    clear();

    const validacion =
      validarCliente(valorEditado);

    if (validacion) {
      setErrorCampo(validacion);
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
        setMensaje(resultado.error);
        return;
      }

      const guardado =
        resultado.porcentajeRecargo;

      setValorGuardado(guardado);
      setValorEditado(
        formatearPorcentaje(guardado),
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
                value={valorEditado}
                onChange={(e) => {
                  const valor = e.target.value;

                  // Impide escribir más de dos cifras decimales. Permite estados
                  // intermedios (p. ej. "5.") para que la edición sea normal.
                  if (/^(\d*\.?\d{0,2})?$/.test(valor)) {
                    setValorEditado(valor);

                    if (errorCampo) {
                      setErrorCampo(null);
                    }
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

          {errorCampo && (
            <p
              className="mt-2 text-sm text-destructive"
              id="recargo-error"
            >
              {errorCampo}
            </p>
          )}

          <div className="rounded-md border border-border bg-surface-2 p-4">
            <p className="text-sm text-muted-foreground">
              Recargo actualmente configurado
            </p>

            <p className="mt-1 text-2xl font-semibold text-primary">
              {formatearPorcentaje(valorGuardado)}
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