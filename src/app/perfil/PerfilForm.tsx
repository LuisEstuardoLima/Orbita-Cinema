"use client";

import { useActionState, useEffect, useState, type ChangeEvent } from "react";
import { actualizarPerfil, type PerfilActionState } from "./actions";

const ESTADO_INICIAL: PerfilActionState = { ok: false, mensaje: "" };

export function PerfilForm({
  nombre,
  apellido,
  telefono,
  email,
}: {
  nombre: string;
  apellido: string;
  telefono: string;
  email: string;
}) {
  const [estado, formAction, pendiente] = useActionState(
    actualizarPerfil,
    ESTADO_INICIAL,
  );
  const [mensajeExito, setMensajeExito] = useState("");
  const [datosEditados, setDatosEditados] = useState(false);

  const detectarCambios = (event: ChangeEvent<HTMLFormElement>) => {
    const formData = new FormData(event.currentTarget);
    setDatosEditados(
      formData.get("nombre") !== nombre ||
        formData.get("apellido") !== apellido ||
        formData.get("telefono") !== telefono,
    );
  };

  useEffect(() => {
    if (!estado.ok || !estado.mensaje) return;

    setMensajeExito(estado.mensaje);
    const timeout = window.setTimeout(() => setMensajeExito(""), 6000);
    return () => window.clearTimeout(timeout);
  }, [estado]);

  return (
    <form
      action={formAction}
      onChange={detectarCambios}
      className="grid gap-5 sm:grid-cols-2"
    >
      <div>
        <label className="label" htmlFor="nombre">
          Nombre
        </label>
        <input
          id="nombre"
          name="nombre"
          className="field"
          defaultValue={nombre}
          autoComplete="given-name"
          required
          maxLength={100}
        />
      </div>

      <div>
        <label className="label" htmlFor="apellido">
          Apellido
        </label>
        <input
          id="apellido"
          name="apellido"
          className="field"
          defaultValue={apellido}
          autoComplete="family-name"
          required
          maxLength={100}
        />
      </div>

      <div>
        <label className="label" htmlFor="correo">
          Correo electrónico
        </label>
        <input
          id="correo"
          name="correo"
          type="email"
          className="field cursor-not-allowed opacity-70"
          value={email}
          readOnly
          autoComplete="email"
          aria-describedby="correo-ayuda"
        />
        <p id="correo-ayuda" className="mt-1 text-xs text-muted-foreground">
          El correo de la cuenta no se puede cambiar desde el perfil.
        </p>
      </div>

      <div>
        <label className="label" htmlFor="telefono">
          Teléfono
        </label>
        <input
          id="telefono"
          name="telefono"
          type="tel"
          className="field"
          defaultValue={telefono}
          autoComplete="tel"
          required
          minLength={8}
          maxLength={30}
          pattern="[0-9 +()-]+"
        />
      </div>

      {(!estado.ok && estado.mensaje) || mensajeExito ? (
        <p
          role={estado.ok ? "status" : "alert"}
          className={`col-span-full rounded-lg border p-3 text-sm ${
            estado.ok
              ? "border-emerald-700/60 bg-emerald-950/30 text-emerald-300"
              : "border-rose-700/60 bg-rose-950/30 text-rose-300"
          }`}
        >
          {estado.ok ? mensajeExito : estado.mensaje}
        </p>
      ) : null}

      <button
        type="submit"
        className="btn-primary col-span-full mt-1 w-fit justify-self-start disabled:cursor-not-allowed disabled:bg-gray-600 disabled:text-gray-300 disabled:shadow-none disabled:hover:brightness-100 disabled:active:scale-100"
        disabled={pendiente || !datosEditados}
      >
        {pendiente ? "Guardando..." : "Guardar cambios"}
      </button>
    </form>
  );
}
