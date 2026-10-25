"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { assertRol } from "@/lib/auth/guard";
import { ROLES_PANEL } from "@/lib/permisos";
import {
  MENSAJES_RECHAZO,
  normalizarCodigoQr,
  normalizarNumero,
  type DatosEntrada,
  type ModoBusqueda,
  type MotivoRechazo,
  type ResultadoValidacion,
} from "@/lib/validacion";

/**
 * SCRUM-140: validación de entradas en el servidor.
 *
 * Quien llama es el panel (Colaborador o Administrador): el rol se verifica AQUÍ con `assertRol`
 * (no basta con ocultar la pantalla). La comprobación y el cambio a "utilizada" ocurren en la
 * función SQL `validar_entrada`, en una sola transacción con la reserva bloqueada
 * (supabase/sprint4-validar-entrada.sql): dos solicitudes simultáneas no pueden validar la misma
 * reserva y un rechazo o un error no modifica nada.
 *
 * Dos pasos: primero se consulta (`confirmar: false`, no modifica nada) y solo al pulsar el botón
 * se valida (`confirmar: true`).
 *
 * La función NO se elige: se toma de la propia reserva (QR, número de reserva o ID de entrada).
 */

type DatosBd = {
  id_compra: number;
  id_entrada: number | null;
  comprador: string;
  total: number | string;
  estado: string;
  id_funcion: number;
  pelicula: string | null;
  sala: string | null;
  fecha_funcion: string | null;
  hora_funcion: string | null;
  fecha_uso: string | null;
  asientos: string[] | null;
};

type RespuestaBd = {
  ok: boolean;
  motivo: MotivoRechazo | null;
} & Partial<DatosBd>;

function aDatos(d: Partial<DatosBd>): DatosEntrada | undefined {
  if (d.id_compra == null) return undefined;
  return {
    idCompra: Number(d.id_compra),
    idEntrada: d.id_entrada == null ? null : Number(d.id_entrada),
    comprador: d.comprador ?? "",
    total: Number(d.total ?? 0),
    estado: d.estado ?? "",
    idFuncion: Number(d.id_funcion),
    pelicula: d.pelicula ?? null,
    sala: d.sala ?? null,
    fechaFuncion: d.fecha_funcion ?? null,
    horaFuncion: d.hora_funcion ? String(d.hora_funcion).slice(0, 5) : null,
    fechaUso: d.fecha_uso ?? null,
    asientos: d.asientos ?? [],
  };
}

export async function validarEntrada(input: {
  modo: ModoBusqueda;
  valor: string;
  /** false = solo consultar y mostrar los datos; true = marcar la reserva como utilizada. */
  confirmar: boolean;
}): Promise<ResultadoValidacion> {
  // 1) Permisos: solo Colaborador y Administrador (Cliente y sin sesión quedan fuera).
  const sinPermiso = await assertRol(ROLES_PANEL);
  if (sinPermiso) return { ok: false, motivo: "permiso", mensaje: sinPermiso };

  // 2) Entrada: todo se vuelve a validar aquí, sin confiar en el navegador.
  const valor = typeof input?.valor === "string" ? input.valor : "";

  const params: { p_codigo_qr?: string; p_id_boleto?: number; p_id_reserva?: number } = {};
  if (input?.modo === "qr") {
    const codigo = normalizarCodigoQr(valor);
    // Un QR que no tiene el formato del boleto no puede identificar ninguna reserva.
    if (!codigo)
      return { ok: false, motivo: "no_encontrada", mensaje: MENSAJES_RECHAZO.no_encontrada };
    params.p_codigo_qr = codigo;
  } else if (input?.modo === "entrada" || input?.modo === "reserva") {
    const n = normalizarNumero(valor);
    if (n == null) {
      return {
        ok: false,
        motivo: "datos",
        mensaje:
          input.modo === "entrada"
            ? "Escribe un ID de entrada válido (solo números)."
            : "Escribe un número de reserva válido (solo números).",
      };
    }
    if (input.modo === "entrada") params.p_id_boleto = n;
    else params.p_id_reserva = n;
  } else {
    return { ok: false, motivo: "datos", mensaje: "Elige cómo buscar la entrada." };
  }

  // 3) Quién valida (solo para auditoría; con AUTH_GUARD apagado puede no haber sesión).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 4) Comprobación + cambio de estado, atómicos, en la base de datos.
  const { data, error } = await createAdminClient().rpc("validar_entrada", {
    ...params,
    p_validador: user?.id ?? null,
    p_confirmar: input?.confirmar === true,
  });
  if (error || !data) {
    return {
      ok: false,
      motivo: "error",
      mensaje:
        "No se pudo completar la validación. Intenta de nuevo; la reserva no fue modificada.",
    };
  }

  const r = data as RespuestaBd;
  const datos = aDatos(r);
  if (r.ok && datos) return { ok: true, datos };

  const motivo = (r.motivo ?? "no_encontrada") as MotivoRechazo;
  return {
    ok: false,
    motivo,
    mensaje: MENSAJES_RECHAZO[motivo] ?? MENSAJES_RECHAZO.no_encontrada,
    ...(datos ? { datos } : {}),
  };
}
