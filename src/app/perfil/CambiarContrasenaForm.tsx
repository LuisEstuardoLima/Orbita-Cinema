"use client";

import { useActionState, useEffect, useState } from "react";
import { Modal } from "@/components/cinema/Modal";
import { cambiarContrasena, type ContrasenaActionState } from "./actions";

const ESTADO_INICIAL: ContrasenaActionState = { ok: false, mensaje: "" };

export function CambiarContrasenaForm() {
  const [abierto, setAbierto] = useState(false);
  const [mensajeExito, setMensajeExito] = useState("");

  useEffect(() => {
    if (!mensajeExito) return;

    const timeout = window.setTimeout(() => setMensajeExito(""), 6000);
    return () => window.clearTimeout(timeout);
  }, [mensajeExito]);

  return (
    <div className="mt-2 border-t border-[#4a4a4a] pt-6">
      <button
        type="button"
        className="btn-primary"
        onClick={() => {
          setMensajeExito("");
          setAbierto(true);
        }}
      >
        Cambiar contraseña
      </button>
      {mensajeExito ? (
        <p role="status" className="mt-4 text-sm text-emerald-300">
          {mensajeExito}
        </p>
      ) : null}
      {abierto ? (
        <CambiarContrasenaModal
          onClose={() => setAbierto(false)}
          onSuccess={(mensaje) => {
            setMensajeExito(mensaje);
            setAbierto(false);
          }}
        />
      ) : null}
    </div>
  );
}

function CambiarContrasenaModal({
  onSuccess,
  onClose,
}: {
  onSuccess: (mensaje: string) => void;
  onClose: () => void;
}) {
  const [estado, formAction, pendiente] = useActionState(cambiarContrasena, ESTADO_INICIAL);

  useEffect(() => {
    if (estado.ok && estado.mensaje) onSuccess(estado.mensaje);
  }, [estado, onSuccess]);

  return (
    <Modal
      open
      title="Cambiar contraseña"
      onClose={onClose}
      sinCerrar={pendiente}
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose} disabled={pendiente}>
            Cancelar
          </button>
          <button
            type="submit"
            form="cambiar-contrasena-form"
            className="btn-primary"
            disabled={pendiente}
          >
            {pendiente ? "Guardando..." : "Guardar cambios"}
          </button>
        </>
      }
    >
      <form id="cambiar-contrasena-form" action={formAction} className="space-y-5">
        <div>
          <label className="label" htmlFor="contrasenaActual">
            Contraseña actual
          </label>
          <input
            id="contrasenaActual"
            name="contrasenaActual"
            type="password"
            className="field"
            autoComplete="current-password"
            required
          />
        </div>

        <div>
          <label className="label" htmlFor="contrasenaNueva">
            Nueva contraseña
          </label>
          <input
            id="contrasenaNueva"
            name="contrasenaNueva"
            type="password"
            className="field"
            autoComplete="new-password"
            minLength={6}
            required
          />
        </div>

        <div>
          <label className="label" htmlFor="confirmarContrasena">
            Confirmar nueva contraseña
          </label>
          <input
            id="confirmarContrasena"
            name="confirmarContrasena"
            type="password"
            className="field"
            autoComplete="new-password"
            minLength={6}
            required
          />
        </div>

        {estado.mensaje && !estado.ok ? (
          <p
            role="alert"
            className="rounded-lg border border-rose-700/60 bg-rose-950/30 p-3 text-sm text-rose-300"
          >
            {estado.mensaje}
          </p>
        ) : null}
      </form>
    </Modal>
  );
}
