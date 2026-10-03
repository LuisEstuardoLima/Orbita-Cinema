import type { Metadata } from "next";
import { AdminPeliculasClient } from "./admin-peliculas-client";

export const metadata: Metadata = {
  title: "Gestión de películas | Órbita Cinema",
  description:
    "Panel de administración de Órbita Cinema para registrar, editar y eliminar películas de la cartelera.",
  robots: { index: false, follow: false },
  openGraph: {
    title: "Gestión de películas | Órbita Cinema",
    description: "Panel de administración de cartelera.",
  },
};

export default function Page() {
  return <AdminPeliculasClient />;
}
