import { useEffect, useRef, useState } from "react";

/**
 * Gestiona un mensaje con auto-ocultado tras `durationMs` (por defecto 8s).
 *
 * - Cada mensaje nuevo reinicia el temporizador (cancela el previo).
 * - El cleanup cancela el temporizador al desmontar o al cambiar el mensaje.
 * - No provoca actualizaciones de estado innecesarias: solo pone `null` cuando
 *   el temporizador expira o se limpia manualmente.
 */
export function useTimedMessage(durationMs: number = 8000) {
  const [mensaje, setMensaje] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Cancela el temporizador activo sin tocar el estado. */
  const cancelTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  /** Limpia el temporizador y borra el mensaje. */
  const clear = () => {
    cancelTimer();
    setMensaje(null);
  };

  useEffect(() => {
    // Cancela cualquier temporizador previo sin borrar el mensaje nuevo.
    cancelTimer();
    if (mensaje) {
      timerRef.current = setTimeout(() => {
        setMensaje(null);
        timerRef.current = null;
      }, durationMs);
    }
    return () => cancelTimer();
  }, [mensaje, durationMs]);

  return { mensaje, setMensaje, clear };
}