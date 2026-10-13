import type { Metadata } from "next";
import { CANTIDADES_VACIAS, cantidadesDeParams, validarCantidades } from "@/lib/compra";
import { getFuncionCompra } from "@/lib/db/compra";
import { num, type SP } from "@/lib/search-params";
import { EntradasClient } from "./entradas-client";

export const dynamic = "force-dynamic"; // depende de la función, sus precios y la hora actual

export const metadata: Metadata = {
  title: "Selección de entradas | Órbita Cinema",
  description:
    "Elige la cantidad de entradas de adulto, tercera edad o niños para tu función en Órbita Cinema.",
  openGraph: {
    title: "Selección de entradas | Órbita Cinema",
    description: "Elige tus entradas y continúa con la compra.",
  },
};

/**
 * SCRUM-117: la función llega por `?funcion=<id>`; sus datos y los precios de su sala se leen
 * de Supabase. Las cantidades pueden venir en la URL al volver desde /asientos ("Cancelar");
 * si no son válidas se empieza en 0.
 */
export default async function Page({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const datos = await getFuncionCompra(num(sp["funcion"]));
  const cantidades = cantidadesDeParams(sp);

  return (
    <EntradasClient
      datos={datos}
      cantidadesIniciales={validarCantidades(cantidades) ? CANTIDADES_VACIAS : cantidades}
    />
  );
}
