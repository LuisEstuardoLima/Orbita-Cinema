"use server";

import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { calcularResumenCompra } from "@/lib/db/compra";
import { claveColumnaAsiento, crearEtiquetasVisibles } from "@/lib/asientos";
import {
  getAsientosOcupadosFuncion,
  getDistribucionAsientos,
} from "@/lib/db/asientos";
import {
  getBloqueoVigente,
  getTokenBloqueo,
  guardarTokenBloqueo,
  liberarBloqueoActual,
} from "@/lib/db/bloqueo";
import type { Cantidades } from "@/lib/compra";
import { TIPOS_ENTRADA } from "@/lib/entradas";
import {
  TIPO_ENTRADA_BD,
  compararAsientos,
  etiquetaAsiento,
  parseAsiento,
} from "@/lib/bloqueo";

/**
 * SCRUM-119 / SCRUM-139:
 * acciones del bloqueo temporal de asientos.
 *
 * El navegador únicamente envía la función, cantidades y asientos elegidos.
 * Los precios, el porcentaje de recargo, el subtotal, el recargo y el total
 * se calculan o validan siempre en el servidor.
 */

type Resultado<T = object> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

/**
 * Datos temporales del comprador mientras /pago todavía
 * no ha capturado la información definitiva.
 */
const NOMBRE_PENDIENTE =
  "Invitado (pendiente)";

const CORREO_PENDIENTE =
  "pendiente@invitado.invalid";

/**
 * Mensajes de errores lanzados por `bloquear_asientos`.
 */
function mensajeDeError(
  mensaje: string,
): string {
  if (
    mensaje.includes("asiento_ocupado")
  ) {
    return "Alguno de los asientos acaba de ser tomado por otra persona. Elige otros.";
  }

  if (
    mensaje.includes("asiento_invalido")
  ) {
    return "Alguno de los asientos elegidos no es válido.";
  }

  if (
    mensaje.includes(
      "funcion_no_disponible",
    )
  ) {
    return "Esta función ya no está disponible.";
  }

  if (
    mensaje.includes("datos_invalidos")
  ) {
    return "Los asientos elegidos no son válidos.";
  }

  return "No se pudieron bloquear los asientos. Intenta de nuevo.";
}

/**
 * Bloquea los asientos elegidos durante 5 minutos.
 *
 * SCRUM-139:
 * `calcularResumenCompra` vuelve a consultar en el servidor:
 * - función;
 * - sala;
 * - tarifas vigentes;
 * - porcentaje de recargo configurado.
 *
 * Por lo tanto, el navegador no puede decidir qué precios
 * ni qué porcentaje se utilizarán.
 */
export async function bloquearAsientosSeleccion(
  input: {
    idFuncion: number;
    cantidades: Cantidades;
    asientos: string[];
  },
): Promise<
  Resultado<{ segundos: number }>
> {
  const { idFuncion, cantidades } =
    input;

  if (
    !Array.isArray(input.asientos) ||
    input.asientos.length === 0 ||
    input.asientos.length > 10
  ) {
    return {
      ok: false,
      error:
        "Elige tus asientos para continuar.",
    };
  }

  /**
   * Fuente única del cálculo monetario.
   *
   * Obtiene precios y porcentaje desde la BD
   * y calcula el resumen en el servidor.
   */
  const resultado =
    await calcularResumenCompra(
      idFuncion,
      cantidades,
    );

  if (!resultado.ok) {
    return {
      ok: false,
      error: resultado.error,
    };
  }

  const { resumen } = resultado;

  if (
    input.asientos.length !==
    resumen.entradas
  ) {
    return {
      ok: false,
      error: `Debes elegir exactamente ${resumen.entradas} asiento(s).`,
    };
  }

  /**
   * Convierte las etiquetas elegidas ("A1")
   * a asientos reales de la sala de la función.
   */
  const admin = createAdminClient();

  const {
    data: fun,
    error: errFun,
  } = await admin
    .from("funcion")
    .select("id_sala")
    .eq("id", idFuncion)
    .maybeSingle();

  if (
    errFun ||
    !fun?.id_sala
  ) {
    return {
      ok: false,
      error:
        "Esta función ya no está disponible.",
    };
  }

  const distribucion =
    await getDistribucionAsientos(
      fun.id_sala,
    );

  const asientosPorColumna = new Map(
    distribucion.map((asiento) => [
      claveColumnaAsiento(asiento.fila, asiento.numero),
      asiento,
    ]),
  );
  const porEtiqueta = new Map<string, (typeof distribucion)[number]>();
  for (const [columna, etiqueta] of crearEtiquetasVisibles(distribucion)) {
    const asiento = asientosPorColumna.get(columna);
    if (asiento) porEtiqueta.set(etiqueta, asiento);
  }

  const elegidos = [];

  for (
    const etiqueta of input.asientos
  ) {
    const p = parseAsiento(etiqueta);

    const asiento = p
      ? porEtiqueta.get(
          etiquetaAsiento(
            p.fila,
            p.numero,
          ),
        )
      : undefined;

    if (!asiento) {
      return {
        ok: false,
        error:
          "Alguno de los asientos elegidos no es válido.",
      };
    }

    elegidos.push(asiento);
  }

  elegidos.sort(compararAsientos);

  /**
   * Tipo y precio de cada asiento.
   *
   * Los precios proceden del resumen calculado
   * anteriormente en el servidor.
   */
  const tipos: string[] = [];
  const precios: number[] = [];

  for (const t of TIPOS_ENTRADA) {
    const linea = resumen.lineas.find(
      (l) => l.tipo === t.id,
    );

    for (
      let i = 0;
      i < (linea?.cantidad ?? 0);
      i++
    ) {
      tipos.push(
        TIPO_ENTRADA_BD[t.id],
      );

      precios.push(
        linea!.precioUnitario,
      );
    }
  }

  /**
   * Comprador:
   * se utiliza la cuenta si existe una sesión.
   * Para invitados se mantienen datos temporales
   * hasta completar /pago.
   */
  const supabase =
    await createClient();

  const {
    data: { user },
  } =
    await supabase.auth.getUser();

  let nombre = NOMBRE_PENDIENTE;
  let correo = CORREO_PENDIENTE;

  if (user) {
    const { data: perfil } =
      await supabase
        .from("usuarios")
        .select(
          "nombre, apellido",
        )
        .eq(
          "id_usuario",
          user.id,
        )
        .maybeSingle();

    const completo =
      `${perfil?.nombre ?? ""} ${
        perfil?.apellido ?? ""
      }`.trim();

    if (completo) {
      nombre = completo;
    }

    if (user.email) {
      correo = user.email;
    }
  }

  const token =
    (await getTokenBloqueo()) ??
    randomUUID();

  /**
   * El porcentaje enviado al RPC NO procede del cliente:
   * es exactamente el porcentaje persistente que
   * `calcularResumenCompra` consultó en la BD.
   *
   * En el siguiente paso reforzaremos también el RPC
   * para que la propia base de datos valide esta información.
   */
  const { data, error } =
    await admin.rpc(
      "bloquear_asientos",
      {
        p_funcion: idFuncion,

        p_asientos:
          elegidos.map(
            (a) => a.id,
          ),

        p_tipos: tipos,

        p_precios: precios,

        p_porcentaje:
          resumen.porcentajeRecargo,

        p_token: token,

        p_usuario:
          user?.id ?? null,

        p_nombre: nombre,

        p_correo: correo,

        p_telefono: null,
      },
    );

  if (error) {
    return {
      ok: false,
      error: mensajeDeError(
        error.message,
      ),
    };
  }

  const fila = (
    data as
      | {
          out_segundos: number;
        }[]
      | null
  )?.[0];

  if (!fila) {
    return {
      ok: false,
      error:
        "No se pudieron bloquear los asientos. Intenta de nuevo.",
    };
  }

  await guardarTokenBloqueo(
    token,
  );

  return {
    ok: true,
    segundos:
      fila.out_segundos,
  };
}

/**
 * SCRUM-120:
 * consulta qué asientos están actualmente ocupados.
 */
export async function consultarOcupacion(
  idFuncion: number,
): Promise<number[] | null> {
  if (
    !Number.isInteger(idFuncion) ||
    idFuncion <= 0
  ) {
    return null;
  }

  try {
    return await getAsientosOcupadosFuncion(
      idFuncion,
      await getTokenBloqueo(),
    );
  } catch {
    return null;
  }
}

/**
 * Libera inmediatamente los asientos
 * bloqueados por este cliente.
 */
export async function liberarBloqueo(): Promise<void> {
  await liberarBloqueoActual();
}

/**
 * Comprueba que el bloqueo actual continúe vigente
 * antes de proceder con el pago.
 */
export async function verificarBloqueo(
  idFuncion: number,
): Promise<
  Resultado<{
    segundosRestantes: number;
  }>
> {
  const bloqueo =
    await getBloqueoVigente();

  if (
    !bloqueo ||
    bloqueo.idFuncion !==
      idFuncion ||
    bloqueo.segundosRestantes <= 0
  ) {
    return {
      ok: false,
      error:
        "El tiempo para completar tu compra venció. Elige tus asientos de nuevo.",
    };
  }

  return {
    ok: true,
    segundosRestantes:
      bloqueo.segundosRestantes,
  };
}