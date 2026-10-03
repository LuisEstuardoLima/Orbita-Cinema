import type { Metadata } from "next";
import { CarteleraClient } from "./cartelera-client";

export const metadata: Metadata = {
  title: "Órbita Cinema | Cartelera y compra de boletos",
  description:
    "Consulta la cartelera de Órbita Cinema, filtra por fecha, horario e idioma y compra tus boletos de cine en línea.",
  openGraph: {
    title: "Órbita Cinema | Cartelera",
    description: "Cartelera, horarios y compra de boletos en Órbita Cinema.",
  },
};

export default function Page() {
  return <CarteleraClient />;
}
