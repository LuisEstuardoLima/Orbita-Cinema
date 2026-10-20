"use client";

import { useState, useTransition } from "react";

import { SiteFooter } from "@/components/cinema/SiteFooter";
import { actualizarContrasena } from "@/lib/auth/actions";

export function ResetPasswordClient({
  code,
}: {
  code: string;
}) {
  const [error, setError] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (
    e: React.FormEvent<HTMLFormElement>,
  ) => {
    e.preventDefault();
    setError("");

    const formData =
      new FormData(e.currentTarget);

    const password =
      formData.get("password") as string;

    const confirmPassword =
      formData.get("confirmar") as string;

    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    if (password.length < 6) {
      setError(
        "La contraseña debe tener al menos 6 caracteres.",
      );
      return;
    }

    startTransition(async () => {
      const response =
        await actualizarContrasena(formData);

      if (response?.error) {
        setError(response.error);
      }
    });
  };

  return (
    <div className="flex min-h-screen flex-col">
      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="card-surface w-full max-w-md rounded-xl p-8">
          <h1 className="mb-2 text-center text-3xl tracking-wide">
            Nueva contraseña
          </h1>

          <p className="mb-6 text-center text-sm text-muted-foreground">
            Elige una contraseña nueva para tu cuenta.
          </p>

          {error && (
            <div className="mb-4 rounded-md border border-destructive bg-destructive/10 p-3 text-center text-sm text-destructive">
              {error}
            </div>
          )}

          <form
            onSubmit={handleSubmit}
            className="space-y-4"
          >
            <input
              type="hidden"
              name="code"
              value={code}
            />

            <div>
              <label
                className="label"
                htmlFor="password"
              >
                Nueva contraseña
              </label>

              <input
                type="password"
                id="password"
                name="password"
                className="field"
                required
                minLength={6}
              />
            </div>

            <div>
              <label
                className="label"
                htmlFor="confirmar"
              >
                Confirmar contraseña
              </label>

              <input
                type="password"
                id="confirmar"
                name="confirmar"
                className="field"
                required
                minLength={6}
              />
            </div>

            <button
              type="submit"
              className="btn-primary mt-6 w-full"
              disabled={isPending}
            >
              {isPending
                ? "Guardando..."
                : "Guardar contraseña"}
            </button>
          </form>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}