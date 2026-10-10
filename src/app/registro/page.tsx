import type { Metadata } from "next";
import { RegistroClient } from "./registro-client";

export const metadata: Metadata = {
  title: "Crear cuenta | Órbita Cinema",
  description: "Regístrate en Órbita Cinema para comprar tus entradas y acceder a beneficios exclusivos.",
};

export default function RegistroPage() {
  return <RegistroClient />;
}