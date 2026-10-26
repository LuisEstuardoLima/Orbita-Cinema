import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type TipoBusquedaAsistente =
  | "entrada"
  | "nombre"
  | "correo";

export type EstadoAsistente =
  | "Vigente"
  | "Cancelada"
  | "Utilizada";

export type AsistenteFuncion = {
  idReserva: number;
  idBoleto: number;
  nombreComprador: string;
  correoComprador: string;
  telefonoComprador: string | null;
  asientos: string[];
  cantidadAsientos: number;
  estado: EstadoAsistente;
  fechaUso: string | null;
  fechaReserva: string;
};

type FilaBd = {
  id_reserva: number;
  id_boleto: number;
  nombre_comprador: string;
  correo_comprador: string;
  telefono_comprador: string | null;
  asientos: string[] | null;
  cantidad_asientos: number | string;
  estado_reserva: string;
  fecha_uso: string | null;
  fecha_reserva: string;
};

function mapEstado(
  estadoReserva: string,
  fechaUso: string | null,
): EstadoAsistente {
  if (
    estadoReserva === "usada" ||
    fechaUso !== null
  ) {
    return "Utilizada";
  }

  if (
    estadoReserva === "cancelada_cliente" ||
    estadoReserva === "cancelada_funcion"
  ) {
    return "Cancelada";
  }

  return "Vigente";
}

export async function listarAsistentesFuncion(
  idFuncion: number,
  tipoBusqueda?: TipoBusquedaAsistente,
  busqueda?: string,
): Promise<AsistenteFuncion[]> {
  const valor = busqueda?.trim() || null;

  const { data, error } =
    await createAdminClient().rpc(
      "listar_asistentes_funcion_admin",
      {
        p_funcion: idFuncion,
        p_tipo_busqueda:
          valor && tipoBusqueda
            ? tipoBusqueda
            : null,
        p_busqueda: valor,
      },
    );

  if (error) {
    throw new Error(
      `listar_asistentes_funcion_admin: ${error.message}`,
    );
  }

  return ((data as FilaBd[] | null) ?? []).map(
    (fila): AsistenteFuncion => ({
      idReserva: Number(fila.id_reserva),
      idBoleto: Number(fila.id_boleto),
      nombreComprador:
        fila.nombre_comprador || "—",
      correoComprador:
        fila.correo_comprador || "—",
      telefonoComprador:
        fila.telefono_comprador,
      asientos: fila.asientos ?? [],
      cantidadAsientos: Number(
        fila.cantidad_asientos ?? 0,
      ),
      estado: mapEstado(
        fila.estado_reserva,
        fila.fecha_uso,
      ),
      fechaUso: fila.fecha_uso,
      fechaReserva: fila.fecha_reserva,
    }),
  );
}