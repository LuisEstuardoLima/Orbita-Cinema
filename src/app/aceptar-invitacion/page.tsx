import type { Metadata } from "next";
import { AceptarInvitacionClient } from "./aceptar-invitacion-client";

export const metadata: Metadata = {
  title: "Aceptar invitación | Órbita Cinema",
  description: "Completa la activación de tu cuenta y establece tu contraseña.",
};

export default function AceptarInvitacionPage() {
  // La sesión de la invitación la detecta el propio cliente Supabase desde la
  // URL (hash de invitación o ?code=); no hace falta leer searchParams aquí.
  return <AceptarInvitacionClient />;
}
