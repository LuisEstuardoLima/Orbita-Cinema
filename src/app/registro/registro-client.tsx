"use client";

import Link from "next/link";
import {
  useState,
  useTransition,
} from "react";

import { SiteFooter } from "@/components/cinema/SiteFooter";
import { registrarCliente } from "@/lib/auth/actions";

export function RegistroClient() {
  const [error, setError] =
    useState<string>("");

  const [
    emailEnviado,
    setEmailEnviado,
  ] = useState<string | null>(
    null,
  );

  const [
    isPending,
    startTransition,
  ] = useTransition();

  const handleSubmit = (
    e: React.FormEvent<HTMLFormElement>,
  ) => {
    e.preventDefault();
    setError("");

    const formData =
      new FormData(
        e.currentTarget,
      );

    const password =
      formData.get(
        "password",
      ) as string;

    const confirmPassword =
      formData.get(
        "confirmPassword",
      ) as string;

    if (
      password.length < 6
    ) {
      setError(
        "La contraseña debe tener al menos 6 caracteres.",
      );
      return;
    }

    if (
      password !==
      confirmPassword
    ) {
      setError(
        "Las contraseñas no coinciden.",
      );
      return;
    }

    startTransition(
      async () => {
        const response =
          await registrarCliente(
            formData,
          );

        if (
          response?.error
        ) {
          setError(
            response.error,
          );
          return;
        }

        setEmailEnviado(
          formData.get(
            "email",
          ) as string,
        );
      },
    );
  };

  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex flex-1 items-center justify-center p-6">
        <div className="card-surface w-full max-w-md rounded-xl p-8">
          <h1 className="mb-6 text-center text-3xl tracking-wide">
            Crear cuenta
          </h1>

          {emailEnviado ? (
            <>
              <div className="mb-4 rounded-md border border-primary/40 bg-primary/10 p-4 text-center text-sm">
                ¡Listo! Te enviamos un
                correo a{" "}
                <span className="font-semibold">
                  {emailEnviado}
                </span>{" "}
                para confirmar tu registro.
                Haz clic en el enlace para
                activar tu cuenta.
              </div>

              <p className="mt-6 text-center text-sm text-muted-foreground">
                ¿Ya tienes cuenta?{" "}
                <Link
                  href="/login"
                  className="text-primary hover:underline"
                >
                  Inicia sesión aquí
                </Link>
              </p>
            </>
          ) : (
            <>
              {error && (
                <div className="mb-4 rounded-md border border-destructive bg-destructive/10 p-3 text-center text-sm text-destructive">
                  {error}
                </div>
              )}

              <form
                onSubmit={
                  handleSubmit
                }
                className="space-y-4"
              >
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label
                      className="label"
                      htmlFor="nombre"
                    >
                      Nombre
                    </label>

                    <input
                      type="text"
                      id="nombre"
                      name="nombre"
                      className="field"
                      required
                    />
                  </div>

                  <div>
                    <label
                      className="label"
                      htmlFor="apellido"
                    >
                      Apellido
                    </label>

                    <input
                      type="text"
                      id="apellido"
                      name="apellido"
                      className="field"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label
                    className="label"
                    htmlFor="telefono"
                  >
                    Teléfono
                  </label>

                  <input
                    type="tel"
                    id="telefono"
                    name="telefono"
                    className="field"
                    required
                  />
                </div>

                <div>
                  <label
                    className="label"
                    htmlFor="email"
                  >
                    Correo Electrónico
                  </label>

                  <input
                    type="email"
                    id="email"
                    name="email"
                    className="field"
                    required
                  />
                </div>

                <div>
                  <label
                    className="label"
                    htmlFor="password"
                  >
                    Contraseña
                  </label>

                  <input
                    type="password"
                    id="password"
                    name="password"
                    className="field"
                    required
                  />
                </div>

                <div>
                  <label
                    className="label"
                    htmlFor="confirmPassword"
                  >
                    Confirmar Contraseña
                  </label>

                  <input
                    type="password"
                    id="confirmPassword"
                    name="confirmPassword"
                    className="field"
                    required
                  />
                </div>

                <button
                  type="submit"
                  className="btn-primary mt-6 w-full"
                  disabled={
                    isPending
                  }
                >
                  {isPending
                    ? "Registrando..."
                    : "Registrarme"}
                </button>
              </form>
            </>
          )}

          {!emailEnviado && (
            <p className="mt-6 text-center text-sm text-muted-foreground">
              ¿Ya tienes cuenta?{" "}
              <Link
                href="/login"
                className="text-primary hover:underline"
              >
                Inicia sesión aquí
              </Link>
            </p>
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}