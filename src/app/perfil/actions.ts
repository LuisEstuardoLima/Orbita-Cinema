"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type ReservaHistorial = {
  id_reserva: number;
  fecha_reserva: string;
  estado: string;
  total: number;
  id_funcion: number;
  fecha_funcion: string;
  hora_funcion: string;
  pelicula: string;
  sala: string;
  puntos_ganados: number;
};

/** Obtiene las reservas propias del usuario autenticado (usa RLS `reserva_select_propia`). */
export async function obtenerMisReservas(): Promise<{
  reservas: ReservaHistorial[];
  error: string | null;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { reservas: [], error: "Usuario no autenticado" };

  const { data, error } = await supabase
    .from("reserva")
    .select(
      `
      id_reserva,
      fecha_reserva,
      estado,
      total,
      id_funcion,
      funcion:funcion!inner(fecha, hora, pelicula:pelicula!inner(titulo), sala:sala!inner(nombre)),
      punto_lealtad:punto_lealtad(tipo_movimiento, puntos)
    `
    )
    .eq("id_usuario", user.id)
    .order("fecha_reserva", { ascending: false });

  if (error) return { reservas: [], error: error.message };

  const reservas = (data ?? []).map((r: any) => {
    const puntosCompra =
      r.punto_lealtad?.filter((p: any) => p.tipo_movimiento === "compra")?.[0]
        ?.puntos ?? 0;
    return {
      id_reserva: r.id_reserva,
      fecha_reserva: r.fecha_reserva,
      estado: r.estado,
      total: Number(r.total),
      id_funcion: r.id_funcion,
      fecha_funcion: r.funcion?.fecha ?? "",
      hora_funcion: r.funcion?.hora ?? "",
      pelicula: r.funcion?.pelicula?.titulo ?? "",
      sala: r.funcion?.sala?.nombre ?? "",
      puntos_ganados: puntosCompra,
    };
  });

  return { reservas, error: null };
}

export type MovimientoPuntos = {
  id_movimiento: number;
  fecha_movimiento: string;
  tipo_movimiento: string;
  puntos: number;
  descripcion: string | null;
  id_reserva: number;
};

export type SaldoMovimientos = {
  movimientos: MovimientoPuntos[];
  saldo: number;
  error: string | null;
};

/** Obtiene los movimientos de puntos de lealtad del usuario autenticado y su saldo acumulado. */
export async function obtenerMovimientosPuntos(): Promise<SaldoMovimientos> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { movimientos: [], saldo: 0, error: "Usuario no autenticado" };

  const { data, error } = await supabase
    .from("punto_lealtad")
    .select("id_movimiento, fecha_movimiento, tipo_movimiento, puntos, descripcion, id_reserva")
    .eq("id_usuario", user.id)
    .order("fecha_movimiento", { ascending: false });

  if (error) return { movimientos: [], saldo: 0, error: error.message };

  const movimientos = (data ?? []).map((m: any) => ({
    id_movimiento: m.id_movimiento,
    fecha_movimiento: m.fecha_movimiento,
    tipo_movimiento: m.tipo_movimiento,
    puntos: Number(m.puntos),
    descripcion: m.descripcion ?? null,
    id_reserva: m.id_reserva,
  }));

  const saldo = movimientos.reduce((acc, m) => acc + m.puntos, 0);

  return { movimientos, saldo, error: null };
}

/** Cancela una reserva propia y acredita el reembolso en puntos (operación atómica en la BD). */
export async function cancelarReserva(idReserva: number): Promise<{
  ok: boolean;
  ya_cancelada?: boolean;
  motivo?: string;
  id_reserva?: number;
  estado?: string;
  reembolso_puntos?: number;
  puntos_revertidos?: number;
  error?: string;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Usuario no autenticado" };

  // Validación de propiedad en el servidor: nunca confiar en id_usuario enviado por el cliente
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("cancelar_reserva_reembolso", {
    p_id_reserva: idReserva,
    p_id_usuario: user.id,
  });

  if (error) return { ok: false, error: error.message };

  const resultado = data as {
    ok: boolean;
    ya_cancelada?: boolean;
    motivo?: string;
    id_reserva?: number;
    estado?: string;
    reembolso_puntos?: number;
    puntos_revertidos?: number;
  };
  return { ...resultado };
}