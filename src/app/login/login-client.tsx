"use client";

import { useState, useTransition } from "react";
import { Film } from "lucide-react";
import { iniciarSesion, solicitarResetContrasena } from "@/lib/auth/actions";
import Link from "next/link";

type Props = {
  /** true cuando llegamos desde el link de confirmación de correo (?confirmado=1). */
  confirmado?: boolean;
  /** true cuando llegamos tras cambiar la contraseña con éxito (?reset=1). */
  resetOk?: boolean;
};

export function LoginClient({ confirmado = false, resetOk = false }: Props) {
  const [error, setError] = useState<string>("");
  const [resetMensaje, setResetMensaje] = useState<string>("");
  // "login" = form normal; "olvido" = pantalla dedicada que solo pide el correo.
  const [vista, setVista] = useState<"login" | "olvido">("login");
  const [isPending, startTransition] = useTransition();
  const [isPendingReset, startResetTransition] = useTransition();

  const limpiarMensajes = () => {
    setError("");
    setResetMensaje("");
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    limpiarMensajes();

    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const response = await iniciarSesion(formData);
      if (response?.error) {
        setError(response.error);
      }
    });
  };

  // Cambia a la pantalla de "olvidé mi contraseña" (solo pide el correo).
  const handleOlvideContrasena = () => {
    limpiarMensajes();
    setVista("olvido");
  };

  const handleEnviarReset = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    limpiarMensajes();

    const formData = new FormData(e.currentTarget);

    startResetTransition(async () => {
      // La action siempre responde ok (no revela si el correo existe).
      const response = await solicitarResetContrasena(formData);
      if (response?.error) {
        setError(response.error);
        return;
      }
      setResetMensaje(
        response?.message ??
          "Si existe una cuenta con ese correo, recibirás un enlace para restablecer tu contraseña.",
      );
    });
  };

  const volverAlLogin = () => {
    limpiarMensajes();
    setVista("login");
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="card-surface w-full max-w-md p-8 rounded-xl">
        <div className="mb-8 flex flex-col items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Film className="h-6 w-6" />
          </span>
          <span className="font-display text-2xl tracking-widest">
            ÓRBITA <span className="text-primary">CINEMA</span>
          </span>
        </div>

        <h1 className="mb-6 text-center text-3xl tracking-wide">
          {vista === "olvido" ? "Recuperar contraseña" : "Iniciar Sesión"}
        </h1>

        {confirmado && (
          <div className="mb-4 border border-green-500/50 bg-green-500/10 p-3 rounded-md text-sm text-center text-green-600">
            ✅ ¡Correo confirmado! Tu cuenta ya está activa. Inicia sesión para continuar.
          </div>
        )}

        {resetOk && (
          <div className="mb-4 border border-green-500/50 bg-green-500/10 p-3 rounded-md text-sm text-center text-green-600">
            ✅ Tu contraseña se actualizó. Ya puedes iniciar sesión.
          </div>
        )}

        {error && (
          <div className="bg-destructive/10 border border-destructive text-destructive p-3 rounded-md mb-4 text-sm text-center">
            {error}
          </div>
        )}

        {vista === "olvido" ? (
          resetMensaje ? (
            <>
              <div className="border border-primary/40 bg-primary/10 p-3 rounded-md mb-6 text-sm text-center">
                {resetMensaje}
              </div>
              <button
                type="button"
                onClick={volverAlLogin}
                className="btn-primary w-full"
              >
                Volver a iniciar sesión
              </button>
            </>
          ) : (
            <form onSubmit={handleEnviarReset} className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                Escribe tu correo y te enviaremos un enlace para crear una nueva contraseña.
              </p>
              <div>
                <label className="label" htmlFor="email-reset">Correo Electrónico:</label>
                <input type="email" id="email-reset" name="email" className="field" placeholder="correo@ejemplo.com" required />
              </div>
              <button
                type="submit"
                className="btn-primary w-full mt-6"
                disabled={isPendingReset}
              >
                {isPendingReset ? "Enviando..." : "OK"}
              </button>
              <button
                type="button"
                onClick={volverAlLogin}
                className="w-full text-sm text-muted-foreground hover:text-primary"
              >
                Volver al inicio de sesión
              </button>
            </form>
          )
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label" htmlFor="email">Correo Electrónico:</label>
              <input type="email" id="email" name="email" className="field" placeholder="correo@ejemplo.com" required />
            </div>
            <div>
              <label className="label" htmlFor="password">Contraseña:</label>
              <input type="password" id="password" name="password" className="field" placeholder="••••••••" required />
            </div>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input type="checkbox" defaultChecked className="h-4 w-4 accent-[var(--primary)]" />
              Recordarme
            </label>

            <div className="mt-7 flex items-center justify-between">
              <button 
                type="submit" 
                className="btn-primary px-8" 
                disabled={isPending}
              >
                {isPending ? "Entrando..." : "Ingresar"}
              </button>
              <button
                type="button"
                onClick={handleOlvideContrasena}
                className="text-sm text-muted-foreground hover:text-primary"
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>
          </form>
        )}

        {!resetMensaje && (
          <p className="mt-6 text-center text-sm text-muted-foreground">
            {vista === "olvido" ? (
              <>
                ¿Ya la recordaste?{" "}
                <button type="button" onClick={volverAlLogin} className="text-primary hover:underline">
                  Inicia sesión aquí
                </button>
              </>
            ) : (
              <>
                ¿No tienes cuenta?{" "}
                <Link href="/registro" className="text-primary hover:underline">
                  Regístrate aquí
                </Link>
              </>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
