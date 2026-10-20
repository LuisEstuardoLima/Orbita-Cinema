import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { num, str, toHref, type SP } from "@/lib/search-params";
import { cantidadesDeParams } from "@/lib/compra";
import { etiquetaAsiento } from "@/lib/bloqueo";
import { getBloqueoVigente } from "@/lib/db/bloqueo";
import { calcularResumenCompra } from "@/lib/db/compra";
import { getPerfilActual } from "@/lib/auth/perfil";
import { PagoClient } from "./pago-client";

export const dynamic = "force-dynamic"; // depende del bloqueo y de la hora

export const metadata: Metadata = {
  title: "Pago y facturación | Órbita Cinema",
  description:
    "Completa tus datos personales, de facturación y de pago para finalizar la compra de tus boletos en Órbita Cinema.",
  openGraph: {
    title: "Pago y facturación | Órbita Cinema",
    description: "Último paso para confirmar tu compra.",
  },
};

/**
 * SCRUM-119: /pago solo se abre con un bloqueo de asientos vigente de ESTE navegador para la
 * función indicada. Si no lo hay (venció, se canceló o se llegó escribiendo la URL), se regresa
 * a elegir asientos. Los asientos y el total que se muestran salen del bloqueo guardado en la
 * BD, no de lo que venga en la URL.
 */
export default async function Page({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const idFuncion = num(sp["funcion"]);
  const cantidades = cantidadesDeParams(sp);

  const bloqueo = await getBloqueoVigente();
  if (!bloqueo || bloqueo.idFuncion !== idFuncion) {
    redirect(idFuncion > 0 ? toHref("/asientos", { funcion: idFuncion, ...cantidades, vencido: 1 }) : "/");
  }

  // Datos reales de la función (título, sala, hora y formato) desde la BD, para
  // que el encabezado siempre muestre la película elegida y no una por defecto.
  const resultado = await calcularResumenCompra(idFuncion, cantidades);
  const funcion = resultado.ok ? resultado.resumen.funcion : null;

  // Ticket INVITADO: con sesión se usan los datos de la cuenta (CA5); sin
  // sesión, el cliente muestra la elección login/invitado (CA1).
  const perfil = await getPerfilActual();
  const cuenta = perfil
    ? { nombre: perfil.nombre, apellido: perfil.apellido, email: perfil.email, telefono: perfil.telefono }
    : null;

  return (
    <PagoClient
      slug={funcion?.slug ?? str(sp["slug"], "batman")}
      titulo={funcion?.pelicula ?? ""}
      hall={funcion?.sala ?? str(sp["hall"])}
      time={funcion?.hora ?? str(sp["time"])}
      format={funcion?.formato ?? str(sp["format"])}
      seats={bloqueo.asientos.map((a) => etiquetaAsiento(a.fila, a.numero)).join(",")}
      total={bloqueo.total}
      idFuncion={idFuncion}
      cantidades={cantidades}
      segundosRestantes={bloqueo.segundosRestantes}
      cuenta={cuenta}
    />
  );
}
