"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { ahoraGuatemala } from "@/lib/fechas";
import { estadoFuncionOpcion } from "@/lib/ocupacion";
import type { FuncionOpcion } from "@/lib/ocupacion";

function formatearFecha(fecha: string) {
  const partes = fecha.split("-");
  return partes.length === 3
    ? `${partes[2]}/${partes[1]}/${partes[0]}`
    : fecha;
}

function crearHref({
  desde,
  hasta,
  pelicula,
  pagina,
  funcion,
}: {
  desde: string;
  hasta: string;
  pelicula: string;
  pagina: number;
  funcion: number | null;
}) {
  const parametros = new URLSearchParams({
    desde,
    hasta,
    pagina: String(pagina),
  });
  if (pelicula) parametros.set("pelicula", pelicula);
  if (funcion !== null) parametros.set("funcion", String(funcion));
  return `/admin/entradas/asistentes?${parametros.toString()}`;
}

export function SelectorFunciones({
  funciones,
  funcionSeleccionada,
  desde,
  hasta,
  pelicula,
  pagina,
  total,
  totalPaginas,
  fechaActual,
  horaActual,
}: {
  funciones: FuncionOpcion[];
  funcionSeleccionada: number | null;
  desde: string;
  hasta: string;
  pelicula: string;
  pagina: number;
  total: number;
  totalPaginas: number;
  fechaActual: string;
  horaActual: string;
}) {
  const router = useRouter();
  const [ahora, setAhora] = useState({
    fecha: fechaActual,
    hora: horaActual,
  });
  const primeraOpcion = (pagina - 1) * 25 + 1;
  const ultimaOpcion = Math.min(pagina * 25, total);

  useEffect(() => {
    const intervalo = setInterval(() => setAhora(ahoraGuatemala()), 30_000);
    return () => clearInterval(intervalo);
  }, []);

  const cambiarFuncion = (valor: string) => {
    const id = valor ? Number(valor) : null;
    if (id !== null && !Number.isSafeInteger(id)) return;
    router.push(
      crearHref({
        desde,
        hasta,
        pelicula,
        pagina,
        funcion: id,
      }),
      { scroll: false },
    );
  };

  return (
    <section className="card-surface p-5">
      <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
        <div>
          <label htmlFor="funcion" className="label">
            Función
          </label>
          <select
            id="funcion"
            className="field mt-1"
            value={funcionSeleccionada === null ? "" : String(funcionSeleccionada)}
            onChange={(event) => cambiarFuncion(event.target.value)}
          >
            <option value="">Selecciona una función</option>
            {funciones.map((funcion) => {
              const estado = estadoFuncionOpcion(
                funcion,
                ahora.fecha,
                ahora.hora,
              );
              return (
                <option key={funcion.id} value={funcion.id}>
                  {formatearFecha(funcion.fecha)} · {funcion.hora} ·{" "}
                  {funcion.pelicula} · {funcion.sala} · {estado}
                </option>
              );
            })}
          </select>
        </div>
        <p className="text-sm text-muted-foreground">
          {total} {total === 1 ? "función encontrada" : "funciones encontradas"}
        </p>
      </div>

      {totalPaginas > 1 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
          <p className="text-sm text-muted-foreground">
            Opciones {primeraOpcion}–{ultimaOpcion} de {total}
          </p>
          <nav aria-label="Páginas de funciones" className="flex gap-2">
            {pagina > 1 ? (
              <Link
                href={crearHref({
                  desde,
                  hasta,
                  pelicula,
                  pagina: pagina - 1,
                  funcion: funcionSeleccionada,
                })}
                className="btn-ghost inline-flex items-center gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Anterior
              </Link>
            ) : (
              <span className="btn-ghost inline-flex cursor-not-allowed items-center gap-2 opacity-50">
                <ArrowLeft className="h-4 w-4" />
                Anterior
              </span>
            )}
            {pagina < totalPaginas ? (
              <Link
                href={crearHref({
                  desde,
                  hasta,
                  pelicula,
                  pagina: pagina + 1,
                  funcion: funcionSeleccionada,
                })}
                className="btn-ghost inline-flex items-center gap-2"
              >
                Siguiente
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : (
              <span className="btn-ghost inline-flex cursor-not-allowed items-center gap-2 opacity-50">
                Siguiente
                <ArrowRight className="h-4 w-4" />
              </span>
            )}
          </nav>
        </div>
      )}
    </section>
  );
}
