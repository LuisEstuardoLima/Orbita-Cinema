import type { Metadata } from "next";
import { LoginClient } from "./login-client";

export const metadata: Metadata = {
  title: "Iniciar sesión | Órbita Cinema",
  description: "Accede a tu cuenta de Órbita Cinema para comprar boletos y ver tu historial.",
  openGraph: {
    title: "Iniciar sesión | Órbita Cinema",
    description: "Accede a tu cuenta de Órbita Cinema.",
  },
};

export default function LoginPage() {
  return <LoginClient />;
}
