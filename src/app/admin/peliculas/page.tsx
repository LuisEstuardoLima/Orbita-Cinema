import type { Metadata } from "next";
import { listPeliculasAdmin } from "@/lib/db/cartelera";
import { AdminPeliculasClient } from "./admin-peliculas-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Gestión de películas | Órbita Cinema",
  description:
    "Panel de administración de Órbita Cinema para registrar y dar de baja películas de la cartelera.",
  robots: { index: false, follow: false },
  openGraph: {
    title: "Gestión de películas | Órbita Cinema",
    description: "Panel de administración de cartelera.",
  },
};

export default async function Page() {
  const peliculas = await listPeliculasAdmin();
  return <AdminPeliculasClient peliculas={peliculas} />;
}
