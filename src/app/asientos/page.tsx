import type { Metadata } from "next";
import { num, str, type SP } from "@/lib/search-params";
import { AsientosClient } from "./asientos-client";

export const metadata: Metadata = {
  title: "Selección de asientos | Órbita Cinema",
  description:
    "Elige tus asientos disponibles en la sala y revisa el resumen de tu compra en Órbita Cinema.",
  openGraph: {
    title: "Selección de asientos | Órbita Cinema",
    description: "Mapa de sala y resumen de compra.",
  },
};

export default async function Page({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  return (
    <AsientosClient
      slug={str(sp["slug"], "batman")}
      hall={str(sp["hall"])}
      time={str(sp["time"])}
      format={str(sp["format"])}
      adulto={num(sp["adulto"])}
      tercera={num(sp["tercera"])}
      ninos={num(sp["ninos"])}
    />
  );
}
