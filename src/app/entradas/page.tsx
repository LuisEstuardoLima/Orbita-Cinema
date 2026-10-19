import type { Metadata } from "next";

import {
  CANTIDADES_VACIAS,
  cantidadesDeParams,
  validarCantidades,
} from "@/lib/compra";
import { getFuncionCompra } from "@/lib/db/compra";
import { getPorcentajeRecargo } from "@/lib/db/configuracion";
import {
  num,
  type SP,
} from "@/lib/search-params";
import { EntradasClient } from "./entradas-client";

export const dynamic = "force-dynamic";
// Depende de la función, sus precios, la hora actual y la configuración del recargo.

export const metadata: Metadata = {
  title:
    "Selección de entradas | Órbita Cinema",
  description:
    "Elige la cantidad de entradas de adulto, tercera edad o niños para tu función en Órbita Cinema.",
  openGraph: {
    title:
      "Selección de entradas | Órbita Cinema",
    description:
      "Elige tus entradas y continúa con la compra.",
  },
};

/**
 * SCRUM-117 / SCRUM-139:
 *
 * La función llega por `?funcion=<id>`;
 * sus datos y los precios de su sala se leen de Supabase.
 *
 * El porcentaje de recargo también se consulta
 * desde la configuración persistente del sistema.
 *
 * Las cantidades pueden venir en la URL al volver
 * desde /asientos ("Cancelar"); si no son válidas,
 * se empieza en 0.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;

  const [datos, porcentajeRecargo] =
    await Promise.all([
      getFuncionCompra(
        num(sp["funcion"]),
      ),
      getPorcentajeRecargo(),
    ]);

  const cantidades =
    cantidadesDeParams(sp);

  return (
    <EntradasClient
      datos={datos}
      cantidadesIniciales={
        validarCantidades(
          cantidades,
        )
          ? CANTIDADES_VACIAS
          : cantidades
      }
      porcentajeRecargo={
        porcentajeRecargo
      }
    />
  );
}