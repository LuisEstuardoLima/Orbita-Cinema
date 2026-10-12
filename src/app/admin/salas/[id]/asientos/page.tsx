/**
 * Configuración de asientos de una sala (SCRUM-110) — placeholder.
 *
 * Existe para que el botón "Asientos" del listado de /admin/salas tenga una
 * ruta válida desde el primer momento. Aquí se definirán filas, columnas,
 * pasillos y asientos deshabilitados de la sala.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { listSalasAdmin } from "@/lib/db/salas";

export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export const metadata: Metadata = {
  title: "Configurar asientos | Órbita Cinema",
  description: "Panel de administración para la distribución de asientos de una sala.",
  robots: { index: false, follow: false },
};

export default async function Page({ params }: { params: Params }) {
  const { id } = await params;
  const idSala = Number(id);

  if (!Number.isInteger(idSala) || idSala <= 0) notFound();

  const salas = await listSalasAdmin();
  const sala = salas.find((s) => s.id === idSala);

  if (!sala) notFound();

  return (
    <section className="card-surface p-6">
      <h1 className="text-3xl tracking-wide">Configurar asientos — {sala.nombre}</h1>

      <p className="mt-2 text-sm text-muted-foreground">
        SCRUM-110 en construcción: aquí se definirán el número de filas y de asientos por
        fila, los pasillos y los espacios deshabilitados de esta sala.
      </p>

      <div className="mt-6 flex items-center justify-between">
        <Link href="/admin/salas" className="btn-ghost">
          <ArrowLeft className="h-4 w-4" />
          Volver a salas
        </Link>

        <span className="rounded-md bg-primary/15 px-2 py-1 text-xs font-bold text-primary">
          {sala.tipo || "—"}
        </span>
      </div>
    </section>
  );
}