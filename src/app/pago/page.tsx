import type { Metadata } from "next";
import { num, str, type SP } from "@/lib/search-params";
import { PagoClient } from "./pago-client";

export const metadata: Metadata = {
  title: "Pago y facturación | Órbita Cinema",
  description:
    "Completa tus datos personales, de facturación y de pago para finalizar la compra de tus boletos en Órbita Cinema.",
  openGraph: {
    title: "Pago y facturación | Órbita Cinema",
    description: "Último paso para confirmar tu compra.",
  },
};

export default async function Page({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  return (
    <PagoClient
      slug={str(sp["slug"], "batman")}
      hall={str(sp["hall"])}
      time={str(sp["time"])}
      format={str(sp["format"])}
      seats={str(sp["seats"])}
      total={num(sp["total"])}
    />
  );
}
