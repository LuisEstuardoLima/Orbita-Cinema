"use server";

import { randomUUID } from "node:crypto";
import QRCode from "qrcode";
import {
  datosInvitadoSchema,
  datosTarjetaSchema,
  soloDigitos,
  type MetodoPago,
} from "@/lib/compra";
import { getBloqueoVigente, getTokenBloqueo, liberarBloqueoActual } from "@/lib/db/bloqueo";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPerfilActual } from "@/lib/auth/perfil";
import { enviarBoletoPorCorreo } from "@/lib/correo";

/**
 * Resultado del pago. `ultimos4` es lo ÚNICO de la tarjeta que se conserva
 * (CA6); `idReserva` es el número de reserva que ve el cliente en la
 * confirmación (CA6 del registro) y `qrDataUrl` es el PNG en base64 del
 * `codigo_qr` del boleto para mostrarlo y descargarlo en pantalla.
 */
export type ResultadoPago =
  | {
      ok: true;
      ultimos4: string | null;
      idReserva: number;
      qrDataUrl: string;
      correoEnviado: boolean;
      /** Puntos registrados en la BD para compras de usuarios registrados; null para invitados o si no se pudo consultar. */
      puntosGanados: number | null;
    }
  | { ok: false; error: string; vencido?: boolean };

/** Mensajes de los errores que lanza confirmar_compra (sprint3-confirmar-compra.sql). */
function mensajeDeConfirmacion(mensaje: string): { error: string; vencido?: boolean } {
  if (mensaje.includes("bloqueo_vencido") || mensaje.includes("reserva_no_pendiente"))
    return { error: "El tiempo para completar tu compra venció. Elige tus asientos de nuevo.", vencido: true };
  if (mensaje.includes("reserva_no_encontrada"))
    return { error: "Tu bloqueo de asientos ya no existe. Elige tus asientos de nuevo.", vencido: true };
  if (mensaje.includes("sin_detalles"))
    return { error: "Tu reserva de asientos ya no es válida. Elige tus asientos de nuevo.", vencido: true };
  if (mensaje.includes("monto_no_coincide"))
    return { error: "El total de la compra cambió. Revisa tu selección e intenta de nuevo." };
  if (mensaje.includes("saldo_puntos_insuficiente"))
    return { error: "Tu saldo de puntos cambió y ya no alcanza para ese canje. Actualiza la página e intenta de nuevo." };
  if (mensaje.includes("canje_requiere_cuenta"))
    return { error: "Debes iniciar sesión para canjear puntos de lealtad." };
  if (mensaje.includes("datos_invalidos"))
    return { error: "Los datos del comprador no son válidos. Revísalos e intenta de nuevo." };
  return { error: "No se pudo registrar la compra. Intenta de nuevo." };
}

/**
 * SIMULACIÓN de pasarela de pago (ticket COMPRA - Pago con tarjeta): no se
 * conecta a ningún banco real. Reglas:
 *   · número terminado en "0000" -> siempre rechazado (p. ej. 4242 4242 4242 0000);
 *   · cualquier otro número válido -> aprobado (p. ej. 4242 4242 4242 4242).
 *
 * Al aprobarse, confirma la compra con la RPC transaccional `confirmar_compra`
 * (SCRUM-125): reserva -> confirmada, asientos -> reservados, pago y boleto
 * registrados, todo o nada. El servidor VUELVE a validar la tarjeta y el
 * comprador: no se confía en la validación del navegador. El CVV nunca viaja.
 */
export async function procesarPago(input: {
  idFuncion: number;
  metodo: MetodoPago;
  tarjeta: { nombre: string; numero: string; vencimiento: string };
  /** Datos del invitado cuando NO hay cuenta; con cuenta el servidor usa la cuenta (CA5) y lo ignora. */
  invitado: { nombre: string; correo: string; telefono: string } | null;
  /** Puntos solicitados para canje; la BD valida el saldo definitivo. */
  puntosCanjeados?: number;
}): Promise<ResultadoPago> {
  // 1) El bloqueo de asientos debe seguir vigente: nunca se cobra sobre
  // asientos que ya se liberaron (CA4: el vencido regresa a /asientos).
  const bloqueo = await getBloqueoVigente();
  if (!bloqueo || bloqueo.idFuncion !== input.idFuncion) {
    return { ok: false, error: "El tiempo para completar tu compra venció. Elige tus asientos de nuevo.", vencido: true };
  }

  // 2) El canje solicitado se vuelve a validar en la RPC transaccional.
  // El navegador solo ayuda a calcular el importe mostrado; no decide el saldo.
  const puntosCanjeados = Number.isInteger(input.puntosCanjeados) && (input.puntosCanjeados ?? 0) > 0
    ? input.puntosCanjeados! : 0;
  const descuentoEstimado = Math.min(bloqueo.total, puntosCanjeados);
  const montoEstimado = Math.max(0, Number((bloqueo.total - descuentoEstimado).toFixed(2)));
  let ultimos4: string | null = null;
  let metodoPago: MetodoPago | "puntos" = input.metodo;

  if (montoEstimado > 0) {
    // Revalida la tarjeta en el servidor (sin CVV: ese dato no viaja, CA6).
    const r = datosTarjetaSchema.omit({ cvv: true }).safeParse(input.tarjeta);
    if (!r.success) {
      return { ok: false, error: r.error.issues[0]?.message ?? "Los datos de la tarjeta no son válidos." };
    }
    ultimos4 = soloDigitos(r.data.numero).slice(-4);
    if (ultimos4 === "0000") {
      return { ok: false, error: "El banco rechazó el pago. Verifica los datos o prueba con otra tarjeta." };
    }
  } else {
    metodoPago = "puntos";
  }

  // 4) Comprador: la cuenta si hay sesión (CA5, leída aquí en el servidor);
  // si no, el invitado revalidado con el mismo schema del navegador (CA3).
  const perfil = await getPerfilActual();
  let nombre: string;
  let correo: string;
  let telefono: string | null;
  if (perfil) {
    nombre = `${perfil.nombre} ${perfil.apellido}`.trim();
    correo = perfil.email;
    telefono = perfil.telefono || null;
  } else {
    const inv = datosInvitadoSchema.safeParse(input.invitado);
    if (!inv.success) {
      return { ok: false, error: "Los datos del invitado no son válidos. Revísalos e intenta de nuevo." };
    }
    nombre = inv.data.nombre;
    correo = inv.data.correo;
    telefono = inv.data.telefono;
  }

  // 5) Confirmación transaccional en la BD (Fase 3 / SCRUM-125). El monto sale
  // del bloqueo (que salió de la reserva); la RPC verifica que coincida.
  const token = await getTokenBloqueo();
  if (!token) {
    return { ok: false, error: "Tu bloqueo de asientos ya no existe. Elige tus asientos de nuevo.", vencido: true };
  }
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("confirmar_compra", {
    p_token: token,
    p_nombre: nombre,
    p_correo: correo,
    p_telefono: telefono,
    p_metodo_pago: metodoPago,
    p_monto: montoEstimado,
    p_ultimos_4: ultimos4,
    p_clave_idempotencia: randomUUID(),
    p_puntos_canjeados: puntosCanjeados,
  });

  if (error) {
    const m = mensajeDeConfirmacion(error.message);
    // Decisión del equipo: si la función ya no está activa, se liberan los
    // asientos y se avisa (la RPC revirtió todo; el bloqueo quedaría inútil).
    if (error.message.includes("funcion_no_disponible")) {
      await liberarBloqueoActual().catch(() => {});
      return { ok: false, error: "Esta función ya no está disponible. Liberamos tus asientos; elige otra película." };
    }
    return { ok: false, ...m };
  }

  const fila = (data as { out_id_reserva: number; out_codigo_qr: string }[] | null)?.[0];
  if (!fila) {
    return { ok: false, error: "No se pudo registrar la compra. Intenta de nuevo." };
  }

  // Genera el QR del token opaco del boleto para mostrarlo y descargarlo en el modal.
  const qrDataUrl = await QRCode.toDataURL(fila.out_codigo_qr, {
    margin: 1,
    width: 240,
  }).catch(() => "");

  // Best-effort: consultar los puntos que realmente quedaron registrados por
  // confirmar_compra. Los invitados (sin perfil) no acumulan puntos.
  // Si la consulta falla, no se muestra una cantidad potencialmente incorrecta;
  // la compra ya está confirmada y no debe tratarse como fallida por esto.
  let puntosGanados: number | null = null;
  if (perfil) {
    const { data: movimientoPuntos } = await admin
      .from("punto_lealtad")
      .select("puntos")
      .eq("id_reserva", fila.out_id_reserva)
      .eq("tipo_movimiento", "compra")
      .maybeSingle();

    if (movimientoPuntos && Number.isFinite(Number(movimientoPuntos.puntos))) {
      puntosGanados = Number(movimientoPuntos.puntos);
    }
  }

  // Best-effort: la compra ya quedó confirmada; si el correo falla, no se
  // revierte nada y la confirmación avisa para que guarde su número ORB-.
  const correoEnviado = await enviarBoletoPorCorreo(fila.out_id_reserva);
  return {
    ok: true,
    ultimos4: ultimos4 ?? "",
    idReserva: fila.out_id_reserva,
    qrDataUrl,
    correoEnviado,
    puntosGanados,
  };
}
