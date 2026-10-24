/**
 * Validación de entradas — ruta `/admin/entradas/validar` (SCRUM-140).
 *
 * Escaneo de QR o búsqueda manual (ID de entrada / número de reserva) para controlar el acceso
 * a la sala. La función se detecta sola a partir de la reserva (no se selecciona). Acceso:
 * Colaborador y Administrador. `src/middleware.ts` cubre `/admin/*` con la matriz de
 * `permisos.ts`, aquí se vuelve a verificar con `exigirRol`, y la Server Action `validarEntrada`
 * lo comprueba otra vez (todo solo con AUTH_GUARD=on).
 */
import type { Metadata } from "next";
import { exigirRol } from "@/lib/auth/pagina";
import { ROLES_PANEL } from "@/lib/permisos";
import { ahoraGuatemala } from "@/lib/fechas";
import { ValidarEntradasClient } from "./validar-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Validación de entradas | Órbita Cinema",
  description: "Panel de Órbita Cinema para validar el ingreso de clientes a las funciones.",
  robots: { index: false, follow: false },
  openGraph: {
    title: "Validación de entradas | Órbita Cinema",
    description: "Escaneo de QR y búsqueda manual de entradas.",
  },
};

export default async function Page() {
  await exigirRol(ROLES_PANEL, "/admin/entradas/validar");
  // Solo se necesita la fecha de hoy para avisar si la entrada es de otro día.
  const { fecha: hoy } = ahoraGuatemala();
  return <ValidarEntradasClient hoy={hoy} />;
}
