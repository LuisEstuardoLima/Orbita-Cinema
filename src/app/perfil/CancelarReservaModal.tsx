"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/cinema/Modal";
import { cancelarReserva } from "./actions";
import { numeroReserva } from "@/lib/compra";

type ReservaCancel = {
  id_reserva: number;
  pelicula: string;
  sala: string;
  fecha_funcion: string;
  hora_funcion: string;
  total: number;
  estado: string;
};

type ResultadoCancelacion = {
  tipo: "exito" | "ya_cancelada" | "error";
  mensaje: string;
  detalle?: string;
};

const MENSAJES_MOTIVO: Record<string, string> = {
  reserva_no_encontrada_o_no_pertenece:
    "No se encontró la reserva o no tienes permiso para cancelarla.",
  reserva_no_confirmada:
    "Esta reserva no se puede cancelar porque no está confirmada.",
  total_invalido:
    "No se pudo procesar el reembolso porque el total de la reserva no es válido.",
  total_desborda_integer:
    "No se pudo calcular el reembolso de esta reserva.",
  funcion_no_encontrada:
    "No se encontró la función asociada a esta reserva.",
  funcion_sin_fecha_hora:
    "La función no tiene una fecha u hora válida.",
  plazo_vencido:
    "La reserva solo se puede cancelar hasta 30 minutos antes de la función.",
  estado_inconsistente_reembolso_previo:
    "La reserva presenta un reembolso previo y debe revisarse.",
  estado_inconsistente_reversion_previa:
    "La reserva presenta movimientos de puntos inconsistentes y debe revisarse.",
  estado_inconsistente_multiples_compras:
    "La reserva tiene movimientos de compra duplicados y debe revisarse.",
};

export function CancelarReservaModal({
  reserva,
}: {
  reserva: ReservaCancel;
}) {
  const router = useRouter();

  const [abierto, setAbierto] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [resultado, setResultado] =
    useState<ResultadoCancelacion | null>(null);

  const handleCancelar = async () => {
    if (procesando) return;

    setProcesando(true);

    try {
      const res = await cancelarReserva(reserva.id_reserva);

      if (res.error) {
        setResultado({
          tipo: "error",
          mensaje: res.error,
        });
        return;
      }

      if (res.ya_cancelada) {
        setResultado({
          tipo: "ya_cancelada",
          mensaje: "Esta reserva ya había sido cancelada anteriormente.",
        });
        return;
      }

      if (!res.ok) {
        const motivo = res.motivo ?? "";

        setResultado({
          tipo: "error",
          mensaje:
            MENSAJES_MOTIVO[motivo] ??
            "No fue posible cancelar la reserva. Verifica que cumpla las condiciones de cancelación.",
        });
        return;
      }

      setResultado({
        tipo: "exito",
        mensaje: `Reserva ${numeroReserva(
          reserva.id_reserva
        )} cancelada correctamente.`,
        detalle: `Se acreditaron ${
          res.reembolso_puntos ?? 0
        } puntos de reembolso${
          typeof res.puntos_revertidos === "number" &&
          res.puntos_revertidos > 0
            ? ` y se revirtieron ${res.puntos_revertidos} puntos obtenidos por la compra`
            : ""
        }.`,
      });

      // El historial se actualizará al cerrar el modal.
    } catch {
      setResultado({
        tipo: "error",
        mensaje:
          "Ocurrió un error inesperado al cancelar la reserva. Inténtalo de nuevo.",
      });
    } finally {
      setProcesando(false);
    }
  };

  const cerrarModal = () => {
    if (procesando) return;

    const actualizarHistorial =
      resultado?.tipo === "exito" ||
      resultado?.tipo === "ya_cancelada";

    setAbierto(false);

    if (actualizarHistorial) {
      router.refresh();
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setResultado(null);
          setAbierto(true);
        }}
        disabled={reserva.estado !== "confirmada"}
      >
        Cancelar reserva
      </Button>

      <Modal
        open={abierto}
        title={`Cancelar reserva ${numeroReserva(
          reserva.id_reserva
        )}`}
        onClose={cerrarModal}
        sinCerrar={procesando}
      >
        {resultado ? (
          <div className="space-y-4 text-center">
            <div
              role={resultado.tipo === "error" ? "alert" : "status"}
              className={
                resultado.tipo === "exito"
                  ? "rounded-xl border border-emerald-700/60 bg-neutral-800 p-4 text-emerald-300"
                  : resultado.tipo === "ya_cancelada"
                    ? "rounded-xl border border-amber-700/60 bg-neutral-800 p-4 text-amber-300"
                    : "rounded-xl border border-rose-700/60 bg-neutral-800 p-4 text-rose-300"
              }
            >
              <p className="font-semibold">
                {resultado.tipo === "exito"
                  ? "✓ "
                  : resultado.tipo === "ya_cancelada"
                    ? "⚠ "
                    : "✕ "}
                {resultado.mensaje}
              </p>

              {resultado.detalle ? (
                <p className="mt-2 text-sm font-normal text-neutral-300">
                  {resultado.detalle}
                </p>
              ) : null}
            </div>

            <div className="flex justify-end">
              <Button onClick={cerrarModal}>Cerrar</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">
              ¿Está seguro de que desea cancelar esta reserva?
            </p>

            <p className="text-sm text-muted-foreground">
              La cancelación está disponible hasta 30 minutos antes de la
              función. El reembolso se realizará en{" "}
              <strong>puntos</strong>, no en efectivo.
            </p>

            <div className="mt-4 flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={cerrarModal}
                disabled={procesando}
              >
                No, mantener reserva
              </Button>

              <Button onClick={handleCancelar} disabled={procesando}>
                {procesando ? "Procesando..." : "Sí, cancelar"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}