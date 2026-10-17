"use client";

import { useEffect, useRef, useState } from "react";
import { Clock } from "lucide-react";
import { formatoContador } from "@/lib/bloqueo";

/**
 * SCRUM-119: contador regresivo del bloqueo de asientos (criterio 4).
 *
 * Recibe los segundos que quedan según la BD y cuenta hacia atrás con el reloj del navegador
 * desde ese momento, así no depende de que el reloj del equipo del cliente esté en hora.
 * Al llegar a cero avisa una sola vez con `onVencido`.
 */
export function ContadorBloqueo({
  segundosIniciales,
  onVencido,
}: {
  segundosIniciales: number;
  onVencido: () => void;
}) {
  const [restante, setRestante] = useState(segundosIniciales);
  const alVencer = useRef(onVencido);
  alVencer.current = onVencido;

  useEffect(() => {
    const fin = Date.now() + segundosIniciales * 1000;
    let avisado = false;

    const tick = () => {
      const r = Math.max(0, Math.ceil((fin - Date.now()) / 1000));
      setRestante(r);
      if (r <= 0 && !avisado) {
        avisado = true;
        alVencer.current();
      }
    };

    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [segundosIniciales]);

  const poco = restante <= 60;

  return (
    <div
      role="timer"
      aria-live="off"
      className={`flex items-center gap-3 rounded-lg border px-4 py-3 text-sm ${
        poco
          ? "border-destructive bg-destructive/10 text-destructive"
          : "border-primary/40 bg-primary/10 text-foreground"
      }`}
    >
      <Clock className="h-5 w-5 shrink-0" />
      <span>
        Tus asientos están reservados por{" "}
        <span className="font-mono text-lg font-bold tabular-nums">{formatoContador(restante)}</span>
        . Completa tu compra antes de que se agote el tiempo.
      </span>
    </div>
  );
}
