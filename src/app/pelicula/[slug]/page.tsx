import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MOVIES } from "@/lib/cinema-data";
import { PeliculaClient } from "./pelicula-client";

type Params = Promise<{ slug: string }>;

export function generateStaticParams() {
  return MOVIES.map((m) => ({ slug: m.slug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const movie = MOVIES.find((m) => m.slug === slug);
  const title = movie
    ? `${movie.title} | Órbita Cinema`
    : "Detalle de película y horarios | Órbita Cinema";
  return {
    title,
    description:
      "Consulta sinopsis, salas, formatos e idiomas disponibles y elige el horario de tu función en Órbita Cinema.",
    openGraph: { title, description: "Salas, horarios e idiomas disponibles." },
  };
}

export default async function Page({ params }: { params: Params }) {
  const { slug } = await params;
  if (!MOVIES.some((m) => m.slug === slug)) notFound();
  return <PeliculaClient slug={slug} />;
}
