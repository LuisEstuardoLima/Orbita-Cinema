"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type PerfilActionState = {
  ok: boolean;
  mensaje: string;
};

const perfilSchema = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio.").max(100, "El nombre no puede superar 100 caracteres."),
  apellido: z.string().trim().min(1, "El apellido es obligatorio.").max(100, "El apellido no puede superar 100 caracteres."),
  telefono: z
    .string()
    .trim()
    .min(8, "Escribe un teléfono válido (mínimo 8 dígitos).")
    .max(30, "El teléfono no puede superar 30 caracteres.")
    .regex(/^[0-9\s\-+()]+$/, "El teléfono solo puede contener dígitos, espacios, guiones y paréntesis."),
});

export async function actualizarPerfil(
  _estado: PerfilActionState,
  formData: FormData,
): Promise<PerfilActionState> {
  const parsed = perfilSchema.safeParse({
    nombre: formData.get("nombre"),
    apellido: formData.get("apellido"),
    telefono: formData.get("telefono"),
  });
  if (!parsed.success) {
    return {
      ok: false,
      mensaje: parsed.error.issues[0]?.message ?? "Revisa los datos ingresados.",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: errorSesion,
  } = await supabase.auth.getUser();
  if (errorSesion || !user) {
    return { ok: false, mensaje: "Debes iniciar sesión para actualizar tu perfil." };
  }

  const { data, error } = await supabase
    .from("usuarios")
    .update({
      nombre: parsed.data.nombre,
      apellido: parsed.data.apellido,
      telefono: parsed.data.telefono,
    })
    .eq("id_usuario", user.id)
    .select("id_usuario")
    .maybeSingle();

  if (error) {
    console.error("[perfil] No se pudieron actualizar los datos personales:", error);
    return { ok: false, mensaje: "No se pudieron guardar tus datos. Inténtalo de nuevo." };
  }
  if (!data) {
    return { ok: false, mensaje: "No se encontró tu perfil para actualizar." };
  }

  revalidatePath("/perfil");
  return { ok: true, mensaje: "Tus datos personales se actualizaron correctamente." };
}

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
  asientos: string[];
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
      detalle_reserva(asiento:asiento(fila, numero)),
      pago(monto, estado),
      punto_lealtad:punto_lealtad(tipo_movimiento, puntos)
    `
    )
    .eq("id_usuario", user.id)
    .in("estado", [
      "confirmada",
      "usada",
      "utilizada",
      "completada",
      "cancelada_cliente",
      "cancelada",
      "cancelada_funcion",
    ])
    .order("fecha_reserva", { ascending: false });

  if (error) {
    console.error("[perfil] No se pudieron consultar las reservas:", error);
    return {
      reservas: [],
      error: "No fue posible cargar tus reservas. Inténtalo de nuevo.",
    };
  }

  type FuncionRelacion = {
    fecha: string;
    hora: string;
    pelicula: { titulo: string } | null;
    sala: { nombre: string } | null;
  };
  type DetalleRelacion = {
    asiento: { fila: string; numero: number } | null;
  };
  type MovimientoCompraRelacion = {
    tipo_movimiento: string;
    puntos: number;
  };
  type PagoRelacion = {
    monto: number;
    estado: string;
  };

  const reservas = (data ?? []).map((r) => {
    const funcion = r.funcion as unknown as FuncionRelacion | null;
    const detalles = r.detalle_reserva as unknown as DetalleRelacion[] | null;
    const pagos = r.pago as unknown as PagoRelacion[] | null;
    const movimientos = r.punto_lealtad as unknown as MovimientoCompraRelacion[] | null;
    const puntosCompra =
      movimientos?.find((p) => p.tipo_movimiento === "compra")?.puntos ?? 0;
    const pagoAprobado = pagos?.find((p) => p.estado === "aprobado");
    const asientos = (detalles ?? [])
      .flatMap((detalle) =>
        detalle.asiento
          ? [`${detalle.asiento.fila}${detalle.asiento.numero}`]
          : [],
      )
      .sort((a, b) => a.localeCompare(b, "es", { numeric: true }));

    return {
      id_reserva: r.id_reserva,
      fecha_reserva: r.fecha_reserva,
      estado: r.estado,
      total: Number(pagoAprobado?.monto ?? r.total),
      id_funcion: r.id_funcion,
      fecha_funcion: funcion?.fecha ?? "",
      hora_funcion: funcion?.hora ?? "",
      pelicula: funcion?.pelicula?.titulo ?? "",
      sala: funcion?.sala?.nombre ?? "",
      asientos,
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

  if (error) {
    console.error("[perfil] No se pudieron consultar los movimientos de puntos:", error);
    return {
      movimientos: [],
      saldo: 0,
      error: "No fue posible cargar tus movimientos de puntos.",
    };
  }

  const movimientos = (data ?? []).map((m) => ({
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