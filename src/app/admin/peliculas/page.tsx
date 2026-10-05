/**
 * Panel de administración de películas — ruta `/admin/peliculas` (SCRUM-104).
 *
 * Server Component mínimo: solo pide la lista al servidor y se la pasa al componente cliente.
 * Toda la interacción (interruptor de activar/desactivar, formulario, buscador) vive en
 * `admin-peliculas-client.tsx`, porque necesita eventos del navegador.
 *
 * `listPeliculasAdmin()` usa la service role (ignora RLS) porque el panel tiene que ver
 * también las películas dadas de baja, que el público no puede leer.
 *
 * `force-dynamic`: el listado cambia cuando el administrador guarda o cambia el estado de una
 * película, así que no puede cachearse.
 *
 * ⚠️ La ruta no tiene enlace en la navegación a propósito (RNF-015), y el acceso lo controla
 * `src/middleware.ts` por rol (solo Administrador), pero SOLO si `AUTH_GUARD=on`. Ver el README.
 */
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
