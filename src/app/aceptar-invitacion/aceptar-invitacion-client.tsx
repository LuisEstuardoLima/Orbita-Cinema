"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function AceptarInvitacionClient() {
  const router = useRouter();
  const [error, setError] = useState<string>("");
  const [cargando, setCargando] = useState(true);
  const [sesionLista, setSesionLista] = useState(false);
  const [isPending, setIsPending] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    // Supabase detecta automáticamente la sesión desde la URL (hash de la
    // invitación o ?code= de recuperación) gracias a detectSessionInUrl.
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error || !session) {
        setError(
          "El enlace de invitación es inválido o expiró. Pide al administrador que te reenvíe la invitación.",
        );
        setCargando(false);
        return;
      }
      setSesionLista(true);
      setCargando(false);
    });
  }, []);

  if (cargando) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 py-12">
        <div className="card-surface w-full max-w-md p-8 rounded-xl text-center">
          <h1 className="mb-4 text-2xl tracking-wide">Aceptar invitación</h1>
          <p className="text-sm text-muted-foreground">Verificando tu invitación…</p>
        </div>
      </div>
    );
  }

  if (!sesionLista) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 py-12">
        <div className="card-surface w-full max-w-md p-8 rounded-xl text-center">
          <h1 className="mb-4 text-2xl tracking-wide">Enlace inválido</h1>
          <div className="bg-destructive/10 border border-destructive text-destructive p-3 rounded-md mb-4 text-sm">
            {error}
          </div>
          <a
            href="/login"
            className="text-sm text-primary hover:underline"
          >
            Volver al inicio de sesión
          </a>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    const formData = new FormData(e.currentTarget as HTMLFormElement);
    const password = formData.get("password") as string;
    const confirmar = formData.get("confirmar") as string;

    if (password !== confirmar) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    setIsPending(true);
    try {
      const supabase = createClient();

      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setError(error.message || "No se pudo establecer la contraseña.");
        setIsPending(false);
        return;
      }

      await supabase.auth.signOut();
      router.replace("/login?invitacion=1");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="card-surface w-full max-w-md p-8 rounded-xl">
        <h1 className="mb-2 text-center text-3xl tracking-wide">
          Establecer contraseña
        </h1>
        <p className="mb-6 text-center text-sm text-muted-foreground">
          Crea tu contraseña para activar tu cuenta.
        </p>

        {error && (
          <div className="bg-destructive/10 border border-destructive text-destructive p-3 rounded-md mb-4 text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="label" htmlFor="password">Nueva contraseña</label>
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
            <label className="label" htmlFor="confirmar">Confirmar contraseña</label>
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
            className="btn-primary w-full mt-6"
            disabled={isPending}
          >
            {isPending ? "Guardando…" : "Guardar contraseña"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          ¿No esperabas esta invitación?{" "}
          <a href="/login" className="text-primary hover:underline">
            Inicia sesión aquí
          </a>
        </p>
      </div>
    </div>
  );
}
