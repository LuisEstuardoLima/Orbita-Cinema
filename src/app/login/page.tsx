import type { Metadata } from "next";
import { str, type SP } from "@/lib/search-params";
import { LoginClient } from "./login-client";

export const metadata: Metadata = {
  title: "Iniciar sesión | Órbita Cinema",
  description: "Accede a tu cuenta de Órbita Cinema para comprar boletos y ver tu historial.",
  openGraph: {
    title: "Iniciar sesión | Órbita Cinema",
    description: "Accede a tu cuenta de Órbita Cinema.",
  },
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  // ?confirmado=1 (tras activar la cuenta), ?reset=1 (tras cambiar la contraseña)
  // y ?invitacion=1 (tras aceptar una invitación y establecer contraseña)
  // muestran un banner de éxito.
  return (
    <LoginClient
      confirmado={str(sp["confirmado"]) === "1"}
      resetOk={str(sp["reset"]) === "1"}
      invitacionOk={str(sp["invitacion"]) === "1"}
      next={str(sp["next"])}
    />
  );
}
