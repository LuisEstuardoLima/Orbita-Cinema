"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Esta página no se pudo cargar
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Algo salió mal de nuestro lado. Puedes intentar de nuevo o volver a la cartelera.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button onClick={() => reset()} className="btn-primary">
            Intentar de nuevo
          </button>
          <a href="/" className="btn-ghost">
            Ir a la cartelera
          </a>
        </div>
      </div>
    </div>
  );
}
