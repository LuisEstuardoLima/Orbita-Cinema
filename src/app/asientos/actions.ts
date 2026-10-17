"use server";

import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { calcularResumenCompra } from "@/lib/db/compra";
import { getAsientosOcupadosFuncion, getDistribucionAsientos } from "@/lib/db/asientos";
import {
  getBloqueoVigente,
  getTokenBloqueo,
  guardarTokenBloqueo,
  liberarBloqueoActual,
} from "@/lib/db/bloqueo";
import { PORCENTAJE_RECARGO, type Cantidades } from "@/lib/compra";
import { TIPOS_ENTRADA } from "@/lib/entradas";
import {
  TIPO_ENTRADA_BD,
  compararAsientos,
  etiquetaAsiento,
  parseAsiento,
} from "@/lib/bloqueo";

/**
 * SCRUM-119: acciones del bloqueo temporal de asientos. El navegador solo pide; todo se valida
 * aquí con datos del servidor (precios, sala, asientos reales, estado actual).
 */

type Resultado<T = object> = ({ ok: true } & T) | { ok: false; error: string };

/** Datos del comprador mientras no los captura /pago (SCRUM-123/125 los reemplazan al pagar). */
const NOMBRE_PENDIENTE = "Invitado (pendiente)";
const CORREO_PENDIENTE = "pendiente@invitado.invalid";

/** Mensajes de los errores que lanza `bloquear_asientos` (supabase/sprint3-bloqueo-asientos.sql). */
function mensajeDeError(mensaje: string): string {
  if (mensaje.includes("asiento_ocupado"))
    return "Alguno de los asientos acaba de ser tomado por otra persona. Elige otros.";
  if (mensaje.includes("asiento_invalido")) return "Alguno de los asientos elegidos no es válido.";
  if (mensaje.includes("funcion_no_disponible"))
    return "Esta función ya no está disponible.";
  if (mensaje.includes("datos_invalidos")) return "Los asientos elegidos no son válidos.";
  return "No se pudieron bloquear los asientos. Intenta de nuevo.";
}

/**
 * Criterio 1: al presionar "Continuar", bloquea los asientos elegidos a nombre de este cliente
 * por 5 minutos. Devuelve los segundos que dura el bloqueo.
 */
export async function bloquearAsientosSeleccion(input: {
  idFuncion: number;
  cantidades: Cantidades;
  asientos: string[];
}): Promise<Resultado<{ segundos: number }>> {
  const { idFuncion, cantidades } = input;
  if (!Array.isArray(input.asientos) || input.asientos.length === 0 || input.asientos.length > 10) {
    return { ok: false, error: "Elige tus asientos para continuar." };
  }

  // Precios, cantidades y reglas de la función: siempre del servidor.
  const resultado = await calcularResumenCompra(idFuncion, cantidades);
  if (!resultado.ok) return { ok: false, error: resultado.error };
  const { resumen } = resultado;

  if (input.asientos.length !== resumen.entradas) {
    return { ok: false, error: `Debes elegir exactamente ${resumen.entradas} asiento(s).` };
  }

  // Etiquetas ("A1") -> asientos reales de la sala de la función.
  const admin = createAdminClient();
  const { data: fun, error: errFun } = await admin
    .from("funcion")
    .select("id_sala")
    .eq("id", idFuncion)
    .maybeSingle();
  if (errFun || !fun?.id_sala) return { ok: false, error: "Esta función ya no está disponible." };

  const distribucion = await getDistribucionAsientos(fun.id_sala);
  const porEtiqueta = new Map(
    distribucion
      .filter((a) => a.estado === "normal")
      .map((a) => [etiquetaAsiento(a.fila, a.numero), a] as const),
  );

  const elegidos = [];
  for (const etiqueta of input.asientos) {
    const p = parseAsiento(etiqueta);
    const asiento = p ? porEtiqueta.get(etiquetaAsiento(p.fila, p.numero)) : undefined;
    if (!asiento) return { ok: false, error: "Alguno de los asientos elegidos no es válido." };
    elegidos.push(asiento);
  }
  elegidos.sort(compararAsientos);

  // Tipo y precio de cada asiento: los tipos se asignan en el orden Adulto, 3ra. Edad, Niños.
  const tipos: string[] = [];
  const precios: number[] = [];
  for (const t of TIPOS_ENTRADA) {
    const linea = resumen.lineas.find((l) => l.tipo === t.id);
    for (let i = 0; i < (linea?.cantidad ?? 0); i++) {
      tipos.push(TIPO_ENTRADA_BD[t.id]);
      precios.push(linea!.precioUnitario);
    }
  }

  // Comprador: la cuenta si hay sesión; si es invitado, valores pendientes que /pago completa.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let nombre = NOMBRE_PENDIENTE;
  let correo = CORREO_PENDIENTE;
  if (user) {
    const { data: perfil } = await supabase
      .from("usuarios")
      .select("nombre, apellido")
      .eq("id_usuario", user.id)
      .maybeSingle();
    const completo = `${perfil?.nombre ?? ""} ${perfil?.apellido ?? ""}`.trim();
    if (completo) nombre = completo;
    if (user.email) correo = user.email;
  }

  const token = (await getTokenBloqueo()) ?? randomUUID();

  const { data, error } = await admin.rpc("bloquear_asientos", {
    p_funcion: idFuncion,
    p_asientos: elegidos.map((a) => a.id),
    p_tipos: tipos,
    p_precios: precios,
    p_porcentaje: PORCENTAJE_RECARGO,
    p_token: token,
    p_usuario: user?.id ?? null,
    p_nombre: nombre,
    p_correo: correo,
    p_telefono: null,
  });
  if (error) return { ok: false, error: mensajeDeError(error.message) };

  const fila = (data as { out_segundos: number }[] | null)?.[0];
  if (!fila) return { ok: false, error: "No se pudieron bloquear los asientos. Intenta de nuevo." };

  await guardarTokenBloqueo(token);
  return { ok: true, segundos: fila.out_segundos };
}

/**
 * SCRUM-120 (criterios 1 y 2): ocupación actual de la función, para que el mapa se actualice
 * sin recargar. Cuenta reservados y bloqueos vigentes de OTROS clientes; un bloqueo vencido ya
 * no cuenta (la BD compara con su propio reloj), así que el asiento reaparece libre.
 * Solo devuelve ids de asiento: no expone datos de compradores.
 */
export async function consultarOcupacion(idFuncion: number): Promise<number[] | null> {
  if (!Number.isInteger(idFuncion) || idFuncion <= 0) return null;
  try {
    return await getAsientosOcupadosFuncion(idFuncion, await getTokenBloqueo());
  } catch {
    return null; // fallo momentáneo: el cliente conserva lo que ya muestra
  }
}

/** Criterio 6: libera de inmediato los asientos bloqueados de este cliente (regresar o cancelar). */
export async function liberarBloqueo(): Promise<void> {
  await liberarBloqueoActual();
}

/**
 * Criterio 5: ¿sigue vigente el bloqueo de esta función? Se llama antes de pagar. Si venció, el
 * cliente debe volver a elegir asientos.
 */
export async function verificarBloqueo(
  idFuncion: number,
): Promise<Resultado<{ segundosRestantes: number }>> {
  const bloqueo = await getBloqueoVigente();
  if (!bloqueo || bloqueo.idFuncion !== idFuncion || bloqueo.segundosRestantes <= 0) {
    return {
      ok: false,
      error: "El tiempo para completar tu compra venció. Elige tus asientos de nuevo.",
    };
  }
  return { ok: true, segundosRestantes: bloqueo.segundosRestantes };
}
