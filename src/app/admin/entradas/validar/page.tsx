/**
 * Validación de entradas — ruta `/admin/entradas/validar` (SCRUM-140).
 *
 * Escaneo de QR o búsqueda manual (ID de entrada / número de reserva) para controlar el acceso
 * a la sala. Acceso: Colaborador y Administrador. `src/middleware.ts` cubre `/admin/*` con la
 * matriz de `permisos.ts`, aquí se vuelve a verificar con `exigirRol`, y la Server Action
 * `validarEntrada` lo comprueba otra vez (todo solo con AUTH_GUARD=on).
 */
import type { Metadata } from "next";
import { exigirRol } from "@/lib/auth/pagina";
import { ROLES_PANEL } from "@/lib/permisos";
import { listFuncionesAdmin } from "@/lib/db/funciones";
import { ahoraGuatemala, parseFecha, toFecha } from "@/lib/fechas";
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

  // Funciones de hoy y de los próximos 7 días (las canceladas también salen, marcadas, para que
  // el rechazo "cancelada" pueda comprobarse).
  const { fecha: hoy, hora: ahora } = ahoraGuatemala();
  const hasta = parseFecha(hoy);
  hasta.setDate(hasta.getDate() + 7);
  const { funciones } = await listFuncionesAdmin({ fechaDesde: hoy, fechaHasta: toFecha(hasta) });

  // Preselecciona la función de hoy más cercana a la hora actual (la primera que no terminó hace
  // más de una hora); si hoy no hay, la primera de la lista.
  const [h = 0, m = 0] = ahora.split(":").map(Number);
  const minAhora = h * 60 + m;
  const deHoy = funciones.filter((f) => f.fecha === hoy && f.activa);
  const sugerida =
    deHoy.find((f) => {
      const [fh = 0, fm = 0] = f.hora.split(":").map(Number);
      return fh * 60 + fm >= minAhora - 60;
    }) ??
    deHoy[0] ??
    funciones[0] ??
    null;

  return (
    <ValidarEntradasClient
      hoy={hoy}
      funciones={funciones.map((f) => ({
        id: f.id,
        pelicula: f.pelicula,
        sala: f.sala,
        fecha: f.fecha,
        hora: f.hora,
        activa: f.activa,
      }))}
      funcionInicial={sugerida?.id ?? null}
    />
  );
}
