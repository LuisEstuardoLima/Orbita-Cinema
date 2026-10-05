/**
 * Detalle de una película (SCRUM-15, SCRUM-17, SCRUM-101).
 *
 * Server Component: corre en el SERVIDOR. Recibe el `slug` de la URL, busca la película y sus
 * funciones de los próximos 7 días, y pasa los datos ya consultados al componente de cliente.
 *
 * Recibe dos parámetros opcionales por la URL:
 * - `fecha` (YYYY-MM-DD): qué día mostrar.
 * - `funcion` (id): qué función dejar marcada. Tiene prioridad sobre `fecha`, porque si venís
 *   desde la cartelera con una hora elegida, el día se deduce de esa función.
 *
 * `force-dynamic`: las funciones dependen de la fecha y hora actuales, así que se recalcula
 * en cada visita. `notFound()` si el slug no existe o la película está dada de baja.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPeliculaBySlug } from "@/lib/db/cartelera";
import { num, str, type SP } from "@/lib/search-params";
import { PeliculaClient } from "./pelicula-client";

export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const pelicula = await getPeliculaBySlug(slug);
  const title = pelicula
    ? `${pelicula.titulo} | Órbita Cinema`
    : "Detalle de película y horarios | Órbita Cinema";
  return {
    title,
    description:
      "Consulta sinopsis, salas, formatos e idiomas disponibles y elige el horario de tu función en Órbita Cinema.",
    openGraph: { title, description: "Salas, horarios e idiomas disponibles." },
  };
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Promise<SP>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const pelicula = await getPeliculaBySlug(slug);
  if (!pelicula) notFound();
  return (
    <PeliculaClient
      pelicula={pelicula}
      fechaInicial={str(sp["fecha"]) || undefined}
      funcionInicial={num(sp["funcion"]) || undefined}
    />
  );
}
