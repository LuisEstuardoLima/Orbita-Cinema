/**
 * Configuración de asientos de una sala (SCRUM-110).
 *
 * Carga la sala, su distribución de asientos ya guardada (si tiene) y si la
 * sala está bloqueada para editar (tiene funciones activas). Toda la lógica
 * interactiva vive en el client; aquí solo se traen los datos del servidor.
 */
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getDistribucionAsientos,
  salaTieneFuncionesActivas,
} from "@/lib/db/asientos";
import { listSalasAdmin } from "@/lib/db/salas";
import { AdminAsientosClient } from "./admin-asientos-client";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export const metadata: Metadata = {
  title: "Configurar asientos | Órbita Cinema",
  description:
    "Panel de administración para la distribución de asientos de una sala.",
  robots: { index: false, follow: false },
};

export default async function Page({ params }: { params: Params }) {
  const { id } = await params;
  const idSala = Number(id);

  if (!Number.isInteger(idSala) || idSala <= 0) notFound();

  const salas = await listSalasAdmin();
  const sala = salas.find((s) => s.id === idSala);

  if (!sala) notFound();

  // Datos del plano y del bloqueo se leen en paralelo.
  const [distribucion, bloqueada] = await Promise.all([
    getDistribucionAsientos(idSala),
    salaTieneFuncionesActivas(idSala),
  ]);

  return (
    <AdminAsientosClient
      sala={sala}
      distribucion={distribucion}
      bloqueada={bloqueada}
    />
  );
}
