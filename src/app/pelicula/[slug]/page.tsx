import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPeliculaBySlug } from "@/lib/db/cartelera";
import { str, type SP } from "@/lib/search-params";
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
  return <PeliculaClient pelicula={pelicula} fechaInicial={str(sp["fecha"]) || undefined} />;
}
