"use client";

import { useState, useTransition } from "react";
import { registrarCliente } from "@/lib/auth/actions";
import Link from "next/link";

export function RegistroClient() {
  const [error, setError] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    const formData = new FormData(e.currentTarget);
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    // Validación: Mínimo de seguridad (Criterio 4)
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }

    // Validación: Coincidencia de contraseñas (Criterio 4)
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    // Enviar datos al servidor
    startTransition(async () => {
      const response = await registrarCliente(formData);
      // Si la Server Action devuelve un error (ej. correo duplicado - Criterio 3)
      if (response?.error) {
        setError(response.error);
      }
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="card-surface w-full max-w-md p-8 rounded-xl">
        <h1 className="text-3xl tracking-wide mb-6 text-center">Crear cuenta</h1>
        
        {error && (
          <div className="bg-destructive/10 border border-destructive text-destructive p-3 rounded-md mb-4 text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label" htmlFor="nombre">Nombre</label>
              <input type="text" id="nombre" name="nombre" className="field" required />
            </div>
            <div>
              <label className="label" htmlFor="apellido">Apellido</label>
              <input type="text" id="apellido" name="apellido" className="field" required />
            </div>
          </div>

          <div>
            <label className="label" htmlFor="telefono">Teléfono</label>
            <input type="tel" id="telefono" name="telefono" className="field" required />
          </div>

          <div>
            <label className="label" htmlFor="email">Correo Electrónico</label>
            <input type="email" id="email" name="email" className="field" required />
          </div>

          <div>
            <label className="label" htmlFor="password">Contraseña</label>
            <input type="password" id="password" name="password" className="field" required />
          </div>

          <div>
            <label className="label" htmlFor="confirmPassword">Confirmar Contraseña</label>
            <input type="password" id="confirmPassword" name="confirmPassword" className="field" required />
          </div>

          <button 
            type="submit" 
            className="btn-primary w-full mt-6" 
            disabled={isPending}
          >
            {isPending ? "Registrando..." : "Registrarme"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="text-primary hover:underline">
            Inicia sesión aquí
          </Link>
        </p>
      </div>
    </div>
  );
}