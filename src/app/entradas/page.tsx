import type { Metadata } from "next";
import { str, type SP } from "@/lib/search-params";
import { EntradasClient } from "./entradas-client";

export const metadata: Metadata = {
  title: "Selección de entradas | Órbita Cinema",
  description:
    "Elige la cantidad de entradas de adulto, tercera edad o niños para tu función en Órbita Cinema.",
  openGraph: {
    title: "Selección de entradas | Órbita Cinema",
    description: "Elige tus entradas y continúa con la compra.",
  },
};

export default async function Page({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  return (
    <EntradasClient
      slug={str(sp["slug"], "batman")}
      hall={str(sp["hall"])}
      time={str(sp["time"])}
      format={str(sp["format"])}
    />
  );
}
