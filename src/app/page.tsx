import type { Metadata } from "next";
import { getCartelera } from "@/lib/db/cartelera";
import { filtrosDesdeParams } from "@/lib/cartelera";
import type { SP } from "@/lib/search-params";
import { CarteleraClient } from "./cartelera-client";

export const dynamic = "force-dynamic"; // la cartelera depende de la fecha y hora actuales

export const metadata: Metadata = {
  title: "Órbita Cinema | Cartelera y compra de boletos",
  description:
    "Consulta la cartelera de Órbita Cinema, filtra por fecha, horario e idioma y compra tus boletos de cine en línea.",
  openGraph: {
    title: "Órbita Cinema | Cartelera",
    description: "Cartelera, horarios y compra de boletos en Órbita Cinema.",
  },
};

export default async function Page({ searchParams }: { searchParams: Promise<SP> }) {
  const [{ peliculas, hoy }, sp] = await Promise.all([getCartelera(), searchParams]);
  return <CarteleraClient peliculas={peliculas} hoy={hoy} iniciales={filtrosDesdeParams(sp, hoy)} />;
}
