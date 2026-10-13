import type { Metadata } from "next";
import { cantidadesDeParams } from "@/lib/compra";
import { calcularResumenCompra } from "@/lib/db/compra";
import { num, str, type SP } from "@/lib/search-params";
import { AsientosClient } from "./asientos-client";

export const dynamic = "force-dynamic"; // el resumen depende de la función, sus precios y la hora

export const metadata: Metadata = {
  title: "Selección de asientos | Órbita Cinema",
  description:
    "Elige tus asientos disponibles en la sala y revisa el resumen de tu compra en Órbita Cinema.",
  openGraph: {
    title: "Selección de asientos | Órbita Cinema",
    description: "Mapa de sala y resumen de compra.",
  },
};

/**
 * SCRUM-122: llegan `funcion` y las cantidades por tipo (adulto, tercera, ninos). El resumen
 * (precios, subtotal, recargo y total) se calcula aquí, en el servidor.
 *
 * `slug`, `hall`, `time` y `format` ya no vienen de /entradas: se derivan de la función real
 * para que el mapa (SCRUM-118) y /pago (SCRUM-124) sigan recibiendo lo mismo que antes.
 */
export default async function Page({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const idFuncion = num(sp["funcion"]);
  const cantidades = cantidadesDeParams(sp);
  const resultado = await calcularResumenCompra(idFuncion, cantidades);
  const funcion = resultado.ok ? resultado.resumen.funcion : null;

  return (
    <AsientosClient
      slug={funcion?.slug ?? str(sp["slug"], "batman")}
      hall={funcion?.sala ?? str(sp["hall"])}
      time={funcion?.hora ?? str(sp["time"])}
      format={funcion?.formato ?? str(sp["format"])}
      adulto={num(sp["adulto"])}
      tercera={num(sp["tercera"])}
      ninos={num(sp["ninos"])}
      idFuncion={idFuncion}
      resumen={resultado.ok ? resultado.resumen : null}
      errorResumen={resultado.ok ? null : resultado.error}
    />
  );
}
