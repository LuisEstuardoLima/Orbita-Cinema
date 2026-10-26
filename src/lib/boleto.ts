"use server";

import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { DatosBoleto } from "@/lib/pdf";
import { claveColumnaAsiento, crearEtiquetasVisibles } from "@/lib/asientos";
import { getDistribucionAsientos } from "@/lib/db/asientos";

type FuncionRelacion = {
  fecha: string;
  hora: string;
  id_sala: number;
  sala: { nombre: string } | null;
  pelicula: { titulo: string; clasificacion: string } | null;
};

type DetalleRelacion = {
  tipo_entrada: string;
  asiento: { fila: string; numero: number } | null;
};

export async function obtenerDatosBoleto(idReserva: number): Promise<{
  datos: DatosBoleto;
  correoComprador: string;
}> {
  const admin = createAdminClient();
  const { data: reserva, error: errorReserva } = await admin
    .from("reserva")
    .select(
      `id_reserva, nombre_comprador, correo_comprador,
       funcion:funcion!inner(
         fecha, hora, id_sala, sala:sala(nombre), pelicula:pelicula(titulo, clasificacion)
       )`,
    )
    .eq("id_reserva", idReserva)
    .eq("estado", "confirmada")
    .maybeSingle();

  if (errorReserva || !reserva || !reserva.funcion || !reserva.correo_comprador) {
    throw new Error(
      `[boleto] No se pudo leer la reserva confirmada: ${errorReserva?.message ?? "sin datos"}`,
    );
  }

  const { data: detalles, error: errorDetalles } = await admin
    .from("detalle_reserva")
    .select("tipo_entrada, asiento:asiento(fila, numero)")
    .eq("id_reserva", idReserva)
    .eq("estado", "reservado");
  if (errorDetalles || !detalles?.length) {
    throw new Error(
      `[boleto] No se pudieron leer los asientos reservados: ${errorDetalles?.message ?? "sin detalles"}`,
    );
  }

  const { data: boleto, error: errorBoleto } = await admin
    .from("boleto")
    .select("codigo_qr")
    .eq("id_reserva", idReserva)
    .maybeSingle();
  if (errorBoleto || !boleto) {
    throw new Error(
      `[boleto] No se pudo leer el código QR: ${errorBoleto?.message ?? "sin boleto"}`,
    );
  }

  const { data: pago, error: errorPago } = await admin
    .from("pago")
    .select("monto")
    .eq("id_reserva", idReserva)
    .eq("estado", "aprobado")
    .maybeSingle();
  if (errorPago || !pago) {
    throw new Error(
      `[boleto] No se pudo leer el total pagado: ${errorPago?.message ?? "sin pago aprobado"}`,
    );
  }

  const funcion = reserva.funcion as unknown as FuncionRelacion;
  const lineas = detalles as unknown as DetalleRelacion[];
  if (!funcion.pelicula || !funcion.sala) {
    throw new Error("[boleto] La función no tiene película o sala asociada.");
  }
  const distribucion = await getDistribucionAsientos(funcion.id_sala);
  const etiquetas = crearEtiquetasVisibles(distribucion);

  return {
    correoComprador: reserva.correo_comprador,
    datos: {
      idReserva: reserva.id_reserva,
      codigoQr: boleto.codigo_qr,
      pelicula: funcion.pelicula.titulo,
      clasificacion: funcion.pelicula.clasificacion,
      fecha: funcion.fecha,
      hora: funcion.hora,
      sala: funcion.sala.nombre,
      comprador: reserva.nombre_comprador,
      totalPagado: Number(pago.monto),
      asientos: lineas.flatMap((detalle) =>
        detalle.asiento
          ? [
              {
                fila: detalle.asiento.fila,
                numero:
                  Number(
                    etiquetas
                      .get(
                        claveColumnaAsiento(
                          detalle.asiento.fila,
                          detalle.asiento.numero,
                        ),
                      )
                      ?.replace(/^[A-Za-z]+/, ""),
                  ) || detalle.asiento.numero,
                tipoEntrada: detalle.tipo_entrada,
              },
            ]
          : [],
      ),
    },
  };
}
