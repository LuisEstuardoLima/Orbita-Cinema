import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export type EstadoEntradaAdmin =
  | "Vigente"
  | "Cancelada"
  | "Utilizada";

export type FilaEntradaAdmin = {
  idReserva: number;
  nombreComprador: string;
  pelicula: string;
  fechaFuncion: string | null;
  horaFuncion: string | null;
  sala: string;
  asientos: string[];
  cantidadAsientos: number;
  estado: EstadoEntradaAdmin;
  fechaReserva: string;
};

export type ListadoEntradasAdminPaginado = {
  filas: FilaEntradaAdmin[];
  total: number;
  pagina: number;
  porPagina: number;
  totalPaginas: number;
};

export type DetalleEntradaAdmin = {
  idReserva: number;
  nombreComprador: string;
  correoComprador: string;
  telefonoComprador: string | null;
  fechaReserva: string;
  total: number;
  estado: EstadoEntradaAdmin;
  idBoleto: number;
  fechaUso: string | null;
  funcion: {
    id: number;
    pelicula: string;
    fecha: string | null;
    hora: string | null;
    sala: string;
  };
  entradas: {
    idDetalle: number;
    asiento: string;
    tipoEntrada: string;
    precio: number;
    estadoDetalle: string;
  }[];
};

type FilaBd = {
  id_reserva: number | string;
  nombre_comprador: string;
  pelicula: string | null;
  fecha_funcion: string | null;
  hora_funcion: string | null;
  sala: string | null;
  asientos: string[] | null;
  cantidad_asientos: number | string;
  estado_reserva: string;
  fecha_uso: string | null;
  fecha_reserva: string;
};

type DetalleBd = {
  id_reserva: number;
  nombre_comprador: string;
  correo_comprador: string;
  telefono_comprador: string | null;
  fecha_reserva: string;
  total: number | string;
  estado_reserva: string;
  id_boleto: number;
  fecha_uso: string | null;
  funcion: {
    id: number;
    pelicula: string | null;
    fecha: string | null;
    hora: string | null;
    sala: string | null;
  };
  entradas: {
    id_detalle: number;
    asiento: string;
    tipo_entrada: string;
    precio: number | string;
    estado_detalle: string;
  }[];
};

type ListadoPaginadoBd = {
  total: number | string;
  pagina: number | string;
  por_pagina: number | string;
  total_paginas: number | string;
  filas: FilaBd[];
};

function mapEstado(
  estadoReserva: string,
  fechaUso: string | null,
): EstadoEntradaAdmin {
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

export async function listarEntradasAdminPaginado(
  busqueda: string | undefined,
  pagina: number,
): Promise<ListadoEntradasAdminPaginado> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc(
    "listar_entradas_admin_paginado",
    {
      p_busqueda: busqueda?.trim() || null,
      p_pagina: pagina,
      p_por_pagina: 50,
    },
  );

  if (
    error?.code === "PGRST202" &&
    error.message.includes("listar_entradas_admin_paginado")
  ) {
    console.warn(
      "listar_entradas_admin_paginado no está disponible en la caché de Supabase; se usará la consulta anterior. Verifica que supabase/sprint4-consulta-entradas.sql se ejecutó en este proyecto y que la caché de PostgREST se recargó.",
      error.message,
    );

    const anterior = await admin.rpc(
      "listar_entradas_admin",
      {
        p_busqueda: busqueda?.trim() || null,
      },
    );
    if (anterior.error) {
      throw new Error(
        `listar_entradas_admin: ${anterior.error.message}`,
      );
    }

    const filas = ((anterior.data as FilaBd[] | null) ?? []).map(
      mapFilaEntradaAdmin,
    );
    const total = filas.length;
    const totalPaginas = Math.max(Math.ceil(total / 50), 1);
    const paginaActual = Math.min(Math.max(pagina, 1), totalPaginas);

    return {
      total,
      pagina: paginaActual,
      porPagina: 50,
      totalPaginas,
      filas: filas.slice(
        (paginaActual - 1) * 50,
        paginaActual * 50,
      ),
    };
  }

  if (error) {
    throw new Error(
      `listar_entradas_admin_paginado: ${error.message}`,
    );
  }

  const resultado = data as ListadoPaginadoBd | null;
  if (!resultado) {
    throw new Error(
      "listar_entradas_admin_paginado: respuesta vacía",
    );
  }

  return {
    total: Number(resultado.total),
    pagina: Number(resultado.pagina),
    porPagina: Number(resultado.por_pagina),
    totalPaginas: Number(resultado.total_paginas),
    filas: (resultado.filas ?? []).map(mapFilaEntradaAdmin),
  };
}

function mapFilaEntradaAdmin(
  fila: FilaBd,
): FilaEntradaAdmin {
  const idReserva = Number(fila.id_reserva);
  if (!Number.isSafeInteger(idReserva) || idReserva <= 0) {
    throw new Error(
      `listar_entradas_admin: ID de reserva inválido (${String(fila.id_reserva)})`,
    );
  }

  return {
    idReserva,
    nombreComprador: fila.nombre_comprador || "—",
    pelicula: fila.pelicula || "—",
    fechaFuncion: fila.fecha_funcion,
    horaFuncion: fila.hora_funcion
      ? String(fila.hora_funcion).slice(0, 5)
      : null,
    sala: fila.sala || "—",
    asientos: fila.asientos ?? [],
    cantidadAsientos: Number(fila.cantidad_asientos ?? 0),
    estado: mapEstado(fila.estado_reserva, fila.fecha_uso),
    fechaReserva: fila.fecha_reserva,
  };
}

export async function obtenerDetalleEntradaAdmin(
  idReserva: number,
): Promise<DetalleEntradaAdmin | null> {
  const { data, error } = await createAdminClient().rpc(
    "detalle_entrada_admin",
    {
      p_id_reserva: idReserva,
    },
  );

  if (error) {
    throw new Error(
      `detalle_entrada_admin: ${error.message}`,
    );
  }

  if (!data) {
    return null;
  }

  const d = data as DetalleBd;

  return {
    idReserva: Number(d.id_reserva),
    nombreComprador:
      d.nombre_comprador || "—",
    correoComprador:
      d.correo_comprador || "—",
    telefonoComprador:
      d.telefono_comprador,
    fechaReserva: d.fecha_reserva,
    total: Number(d.total ?? 0),
    estado: mapEstado(
      d.estado_reserva,
      d.fecha_uso,
    ),
    idBoleto: Number(d.id_boleto),
    fechaUso: d.fecha_uso,
    funcion: {
      id: Number(d.funcion.id),
      pelicula:
        d.funcion.pelicula || "—",
      fecha: d.funcion.fecha,
      hora: d.funcion.hora
        ? String(d.funcion.hora).slice(0, 5)
        : null,
      sala: d.funcion.sala || "—",
    },
    entradas: (d.entradas ?? []).map((e) => ({
      idDetalle: Number(e.id_detalle),
      asiento: e.asiento,
      tipoEntrada: e.tipo_entrada,
      precio: Number(e.precio ?? 0),
      estadoDetalle: e.estado_detalle,
    })),
  };
}