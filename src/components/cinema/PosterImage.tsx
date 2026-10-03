"use client";

import Image from "next/image";
import { useState } from "react";
import { Film } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Póster con respaldo: si la URL falta o no carga (p. ej. un enlace de prueba), muestra un marcador.
 * Las URLs remotas van sin optimizar para no tener que registrar cada dominio en next.config.
 */
export function PosterImage({
  src,
  alt,
  className,
  priority,
}: {
  src: string | null;
  alt: string;
  className?: string;
  priority?: boolean;
}) {
  const [fallo, setFallo] = useState(false);

  if (!src || fallo) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={cn("flex items-center justify-center bg-surface-2 text-muted-foreground", className)}
      >
        <Film className="h-10 w-10 opacity-60" />
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={512}
      height={768}
      priority={priority}
      unoptimized={!src.startsWith("/")}
      onError={() => setFallo(true)}
      className={className}
    />
  );
}
