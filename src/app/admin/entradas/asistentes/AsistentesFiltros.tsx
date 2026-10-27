"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarDays } from "lucide-react";

import { Calendar } from "@/components/ui/calendar";
import { Modal } from "@/components/cinema/Modal";
import { ahoraGuatemala, parseFecha, toFecha } from "@/lib/fechas";

type PeliculaFiltro = {
  id: number;
  titulo: string;
};

const fechaCorta = (fecha: string) =>
  format(parseFecha(fecha), "dd/MM/yyyy");

export function AsistentesFiltros({
  desde,
  hasta,
  pelicula,
  peliculas,
}: {
  desde: string;
  hasta: string;
  pelicula: string;
  peliculas: PeliculaFiltro[];
}) {
  const router = useRouter();
  const [fechaDesde, setFechaDesde] = useState(desde);
  const [fechaHasta, setFechaHasta] = useState(hasta);

  useEffect(() => {
    setFechaDesde(desde);
    setFechaHasta(hasta);
  }, [desde, hasta]);
  const [calendario, setCalendario] = useState<
    "desde" | "hasta" | null
  >(null);
  const [fechaTemporal, setFechaTemporal] = useState("");

  const abrirCalendario = (
    destino: "desde" | "hasta",
    fechaActual: string,
  ) => {
    setFechaTemporal(fechaActual || ahoraGuatemala().fecha);
    setCalendario(destino);
  };

  const confirmarCalendario = () => {
    if (fechaTemporal && calendario === "desde") {
      setFechaDesde(fechaTemporal);
    }
    if (fechaTemporal && calendario === "hasta") {
      setFechaHasta(fechaTemporal);
    }
    setCalendario(null);
  };

  const filtrarPorPelicula = (idPelicula: string) => {
    const parametros = new URLSearchParams({
      desde: fechaDesde,
      hasta: fechaHasta,
      pagina: "1",
    });
    if (idPelicula) parametros.set("pelicula", idPelicula);
    router.push(
      `/admin/entradas/asistentes?${parametros.toString()}`,
      { scroll: false },
    );
  };

  return (
    <>
      <form
        method="get"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]"
      >
        <input type="hidden" name="desde" value={fechaDesde} />
        <input type="hidden" name="hasta" value={fechaHasta} />

        <div className="flex flex-col gap-1">
          <label className="label" htmlFor="filtro-fecha-desde">
            Desde
          </label>
          <button
            id="filtro-fecha-desde"
            type="button"
            className="field flex w-full items-center justify-between px-3 py-2 text-left"
            onClick={() => abrirCalendario("desde", fechaDesde)}
          >
            <span>
              {fechaDesde ? fechaCorta(fechaDesde) : "Desde"}
            </span>
            <CalendarDays className="h-4 w-4 text-primary" />
          </button>
        </div>

        <div className="flex flex-col gap-1">
          <label className="label" htmlFor="filtro-fecha-hasta">
            Hasta
          </label>
          <button
            id="filtro-fecha-hasta"
            type="button"
            className="field flex w-full items-center justify-between px-3 py-2 text-left"
            onClick={() => abrirCalendario("hasta", fechaHasta)}
          >
            <span>
              {fechaHasta ? fechaCorta(fechaHasta) : "Hasta"}
            </span>
            <CalendarDays className="h-4 w-4 text-primary" />
          </button>
        </div>

        <div>
          <label className="label" htmlFor="pelicula">
            Película
          </label>
          <select
            id="pelicula"
            name="pelicula"
            className="field"
            value={pelicula}
            onChange={(event) => filtrarPorPelicula(event.target.value)}
          >
            <option value="">Todas las películas</option>
            {peliculas.map((opcion) => (
              <option key={opcion.id} value={opcion.id}>
                {opcion.titulo}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-end gap-3">
          <button type="submit" className="btn-primary">
            Filtrar funciones
          </button>
          <Link
            href="/admin/entradas/asistentes"
            className="btn-ghost"
          >
            Limpiar
          </Link>
        </div>
      </form>
      <p className="mt-3 text-xs text-muted-foreground">
        Al entrar se muestran las funciones desde hoy hasta los próximos 7 días.
        Cambiar la película actualiza la lista de funciones automáticamente.
      </p>

      <Modal
        open={calendario !== null}
        title="Elegir fecha"
        onClose={() => setCalendario(null)}
        footer={
          <button
            type="button"
            className="btn-primary"
            onClick={confirmarCalendario}
          >
            OK
          </button>
        }
      >
        <div className="flex justify-center">
          <Calendar
            mode="single"
            locale={es}
            selected={
              fechaTemporal
                ? parseFecha(fechaTemporal)
                : undefined
            }
            onSelect={(date) => {
              if (date) setFechaTemporal(toFecha(date));
            }}
            defaultMonth={parseFecha(
              fechaTemporal || ahoraGuatemala().fecha,
            )}
          />
        </div>
      </Modal>
    </>
  );
}
