"use client";

import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";

/**
 * SCRUM-140: lector de códigos QR para la validación de entradas.
 *
 * Usa la cámara del dispositivo (getUserMedia, que exige HTTPS o localhost) y decodifica con
 * jsQR. Alternativa sin cámara: elegir una foto/captura del QR. Cuando lee un código llama a
 * `onCodigo` UNA vez y se detiene; la pantalla decide cuándo volver a escanear (`activo`).
 */
type Props = {
  /** Mientras es false la cámara está apagada (p. ej. al mostrar el resultado). */
  activo: boolean;
  onCodigo: (texto: string) => void;
};

const ANCHO_MAX = 640; // se reduce el cuadro antes de decodificar: más rápido y suficiente

export function EscanerQr({ activo, onCodigo }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const alCodigo = useRef(onCodigo);
  const [error, setError] = useState<string | null>(null);
  const [iniciando, setIniciando] = useState(false);

  useEffect(() => {
    alCodigo.current = onCodigo;
  }, [onCodigo]);

  useEffect(() => {
    if (!activo) return;
    let detenido = false;
    let stream: MediaStream | null = null;
    let raf = 0;
    let ultimo = 0;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Este navegador no permite usar la cámara. Usa la búsqueda manual o sube una imagen del QR.");
      return;
    }

    setError(null);
    setIniciando(true);

    const ciclo = (t: number) => {
      if (detenido) return;
      raf = requestAnimationFrame(ciclo);
      if (t - ultimo < 120) return; // ~8 lecturas por segundo
      ultimo = t;
      if (video.readyState < video.HAVE_ENOUGH_DATA || !video.videoWidth) return;

      const escala = Math.min(1, ANCHO_MAX / video.videoWidth);
      const w = Math.round(video.videoWidth * escala);
      const h = Math.round(video.videoHeight * escala);
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, w, h);
      const lectura = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: "dontInvert" });
      if (lectura?.data) {
        detenido = true;
        cancelAnimationFrame(raf);
        alCodigo.current(lectura.data);
      }
    };

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false })
      .then((s) => {
        if (detenido) {
          s.getTracks().forEach((p) => p.stop());
          return;
        }
        stream = s;
        video.srcObject = s;
        return video.play().then(() => {
          setIniciando(false);
          raf = requestAnimationFrame(ciclo);
        });
      })
      .catch(() => {
        if (detenido) return;
        setIniciando(false);
        setError(
          "No se pudo acceder a la cámara. Revisa el permiso del navegador o usa la búsqueda manual / una imagen del QR.",
        );
      });

    return () => {
      detenido = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((p) => p.stop());
      video.srcObject = null;
    };
  }, [activo]);

  // Alternativa sin cámara: leer el QR de una imagen.
  const leerImagen = async (archivo: File | undefined) => {
    if (!archivo) return;
    setError(null);
    try {
      const bitmap = await createImageBitmap(archivo);
      const escala = Math.min(1, 1000 / Math.max(bitmap.width, bitmap.height));
      const w = Math.round(bitmap.width * escala);
      const h = Math.round(bitmap.height * escala);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) throw new Error("canvas");
      ctx.drawImage(bitmap, 0, 0, w, h);
      const lectura = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: "attemptBoth" });
      if (lectura?.data) alCodigo.current(lectura.data);
      else setError("No se encontró un código QR en la imagen.");
    } catch {
      setError("No se pudo leer la imagen.");
    }
  };

  return (
    <div>
      <div className="relative mx-auto aspect-[4/3] w-full max-w-md overflow-hidden rounded-lg border border-border bg-black">
        <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
        {!activo && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-sm text-white">
            Cámara en pausa
          </div>
        )}
        {activo && !error && (
          <>
            {iniciando && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-sm text-white">
                Iniciando cámara...
              </div>
            )}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-[18%] rounded-lg border-2 border-primary/80"
            />
          </>
        )}
      </div>
      <canvas ref={canvasRef} className="hidden" />

      {error && (
        <p role="alert" className="mt-3 text-center text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="mt-4 text-center">
        <label className="btn-ghost cursor-pointer">
          Subir imagen del QR
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => {
              void leerImagen(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
      </div>
    </div>
  );
}
