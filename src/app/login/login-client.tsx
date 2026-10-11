"use client";

import { useState, useTransition } from "react";
import { Film } from "lucide-react";
import { iniciarSesion } from "@/lib/auth/actions";
import Link from "next/link";

export function LoginClient() {
  const [error, setError] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      const response = await iniciarSesion(formData);
      if (response?.error) {
        setError(response.error);
      }
    });
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

        <h1 className="mb-6 text-center text-3xl tracking-wide">Iniciar Sesión</h1>

        {error && (
          <div className="bg-destructive/10 border border-destructive text-destructive p-3 rounded-md mb-4 text-sm text-center">
            {error}
          </div>
        )}

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
            <a href="#" className="text-sm text-muted-foreground hover:text-primary">
              Olvide mi contraseña
            </a>
          </div>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          ¿No tienes cuenta?{" "}
          <Link href="/registro" className="text-primary hover:underline">
            Regístrate aquí
          </Link>
        </p>
      </div>
    </div>
  );
}
