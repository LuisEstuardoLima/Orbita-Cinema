"use server";

/**
 * SCRUM-109: Server Actions de /admin/salas.
 *
 * Solo un Administrador puede crear, editar, desactivar o reactivar salas.
 * Las reglas de negocio se validan nuevamente en el servidor aunque
 * el formulario también tenga validaciones en el navegador.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertAdmin } from "@/lib/auth/guard";
import { contarSalasActivas } from "@/lib/db/salas";
import {
  salaTieneFuncionesActivas,
  type EstadoAsiento,
} from "@/lib/db/asientos";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SalaRow } from "@/lib/db-types";
import { COLUMNA_PRECIO, TIPOS_ENTRADA, type TipoEntradaId } from "@/lib/entradas";

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string };

// ⚠️ Lista duplicada: la misma está en `admin-salas-client.tsx`. Si se agrega o cambia un tipo,
// actualizar las dos (y PRECIOS_SUGERIDOS). Pendiente unificarla en un módulo compartido.
const TIPOS_SALA = [
  "TRADICIONAL 2D",
  "TRADICIONAL 3D",
  "IMAX 2D",
  "IMAX 3D",
  "MACRO XE 2D",
  "MACRO XE 3D",
  "VIP 2D",
  "VIP 3D",
] as const;

type TipoSala = (typeof TIPOS_SALA)[number];

/**
 * SCRUM-121: precios sugeridos (quetzales) con los que nace una sala nueva según su tipo,
 * para que nunca quede sin precio. Son los mismos que llena `supabase/sprint3-precios.sql`
 * en las salas existentes: si cambian, cambiar los dos lugares.
 * Editar el tipo de una sala existente NO cambia sus precios (`editarSala` no los toca).
 */
const PRECIOS_SUGERIDOS: Record<TipoSala, Record<TipoEntradaId, number>> = {
  "TRADICIONAL 2D": { adulto: 35, tercera: 30, ninos: 25 },
  "TRADICIONAL 3D": { adulto: 45, tercera: 40, ninos: 35 },
  "MACRO XE 2D": { adulto: 50, tercera: 45, ninos: 40 },
  "MACRO XE 3D": { adulto: 60, tercera: 55, ninos: 50 },
  "IMAX 2D": { adulto: 55, tercera: 50, ninos: 45 },
  "IMAX 3D": { adulto: 65, tercera: 60, ninos: 55 },
  "VIP 2D": { adulto: 75, tercera: 70, ninos: 65 },
  "VIP 3D": { adulto: 85, tercera: 80, ninos: 75 },
};

/** { adulto: 35, ... } -> { precio_adulto: 35, ... } (columnas de `sala`). */
const filaPrecios = (precios: Record<TipoEntradaId, number>) =>
  Object.fromEntries(TIPOS_ENTRADA.map((t) => [COLUMNA_PRECIO[t.id], precios[t.id]]));

/** Postgres 42703 (undefined_column): falta correr supabase/sprint3-precios.sql. */
const SIN_COLUMNAS_PRECIO =
  "Faltan las columnas de precio en la base. Ejecuta supabase/sprint3-precios.sql en Supabase.";

/**
 * Reglas del formulario.
 *
 * - nombre obligatorio
 * - tipo obligatorio y limitado a los definidos en la historia
 * (la capacidad no se pide: se deriva de la distribución de asientos)
 */
const schema = z.object({
  nombre: z
    .string({ required_error: "El nombre es obligatorio." })
    .trim()
    .min(1, "El nombre es obligatorio.")
    .max(100, "El nombre es demasiado largo."),

  tipo: z.enum(TIPOS_SALA, {
    errorMap: () => ({
      message: "Elige un tipo de sala válido.",
    }),
  }),
});

// Nota: la capacidad NO se pide aquí. Se deriva de la distribución de
// asientos (SCRUM-110) al guardar el plano en el configurador.

type DatosSala = z.infer<typeof schema>;

/**
 * Obtiene un campo de FormData y limpia espacios.
 */
const campo = (formData: FormData, nombre: string) => {
  const valor = formData.get(nombre);

  return typeof valor === "string" && valor.trim()
    ? valor.trim()
    : undefined;
};

/**
 * Valida y transforma los datos recibidos desde el formulario.
 */
function validarFormulario(
  formData: FormData,
):
  | { ok: true; datos: DatosSala }
  | { ok: false; error: string } {
  const parsed = schema.safeParse({
    nombre: campo(formData, "nombre"),
    tipo: campo(formData, "tipo"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error:
        parsed.error.issues[0]?.message ??
        "Los datos de la sala no son válidos.",
    };
  }

  return {
    ok: true,
    datos: parsed.data,
  };
}

/**
 * Rutas que pueden verse afectadas cuando una sala cambia.
 */
function revalidarSalas() {
  revalidatePath("/admin/salas");
  revalidatePath("/admin/funciones");
  revalidatePath("/");
  revalidatePath("/pelicula/[slug]", "page");
}

/**
 * SCRUM-109: crear una sala nueva.
 *
 * El proyecto permite como máximo 10 salas activas.
 */
export async function crearSala(
  formData: FormData,
): Promise<ActionResult> {
  const denied = await assertAdmin();

  if (denied) {
    return {
      ok: false,
      error: denied,
    };
  }

  const validacion = validarFormulario(formData);

  if (!validacion.ok) {
    return validacion;
  }

  /*
   * La validación del máximo se hace en el servidor.
   * No basta con deshabilitar el botón en la interfaz porque otro
   * administrador podría crear una sala al mismo tiempo.
   */
  try {
    const activas = await contarSalasActivas();

    if (activas >= 10) {
      return {
        ok: false,
        error:
          "Se alcanzó el máximo de 10 salas activas.",
      };
    }
  } catch (error) {
    return {
      ok: false,
      error: `No se pudo validar el límite de salas: ${
        (error as Error).message
      }`,
    };
  }

  const { nombre, tipo } = validacion.datos;

  // Opción A: una sala nueva siempre nace sin asientos (capacidad 0).
  // La capacidad real se recalcula al guardar el plano en
  // `guardarDistribucionAsientos` (único lugar que la actualiza).
  // SCRUM-121: nace con los precios sugeridos de su tipo.
  const { error } = await createAdminClient()
    .from("sala")
    .insert({
      nombre,
      tipo_sala: tipo,
      capacidad: 0,
      activa: true,
      ...filaPrecios(PRECIOS_SUGERIDOS[tipo]),
    });

  if (error) {
    return {
      ok: false,
      error:
        error.code === "42703"
          ? SIN_COLUMNAS_PRECIO
          : `No se pudo registrar la sala: ${error.message}`,
    };
  }

  revalidarSalas();

  return { ok: true };
}

/**
 * SCRUM-109: editar los datos de una sala existente.
 */
export async function editarSala(
  id: number,
  formData: FormData,
): Promise<ActionResult> {
  const denied = await assertAdmin();

  if (denied) {
    return {
      ok: false,
      error: denied,
    };
  }

  if (!Number.isInteger(id) || id <= 0) {
    return {
      ok: false,
      error: "Sala inválida.",
    };
  }

  const validacion = validarFormulario(formData);

  if (!validacion.ok) {
    return validacion;
  }

  const admin = createAdminClient();

  /*
   * Verificamos que la sala siga existiendo antes de editar.
   */
  const actual = await admin
    .from("sala")
    .select("id")
    .eq("id", id)
    .maybeSingle();

  if (actual.error) {
    return {
      ok: false,
      error: `No se pudo consultar la sala: ${actual.error.message}`,
    };
  }

  if (!actual.data) {
    return {
      ok: false,
      error: "La sala no existe.",
    };
  }

  const { nombre, tipo } = validacion.datos;

  const { error } = await admin
    .from("sala")
    .update({
      nombre,
      tipo_sala: tipo,
    })
    .eq("id", id);

  if (error) {
    return {
      ok: false,
      error: `No se pudo actualizar la sala: ${error.message}`,
    };
  }

  revalidarSalas();

  return { ok: true };
}

/**
 * SCRUM-109: desactivar una sala.
 *
 * Es una baja lógica. La fila permanece en la base de datos pero
 * deja de estar disponible en el formulario de nuevas funciones,
 * porque /admin/funciones consulta únicamente salas activas.
 */
export async function desactivarSala(
  id: number,
): Promise<ActionResult> {
  const denied = await assertAdmin();

  if (denied) {
    return {
      ok: false,
      error: denied,
    };
  }

  if (!Number.isInteger(id) || id <= 0) {
    return {
      ok: false,
      error: "Sala inválida.",
    };
  }

  const admin = createAdminClient();

  const { data, error: lecturaError } = await admin
    .from("sala")
    .select("id, nombre, activa")
    .eq("id", id)
    .maybeSingle();

  if (lecturaError) {
    return {
      ok: false,
      error: `No se pudo consultar la sala: ${lecturaError.message}`,
    };
  }

  const sala = data as Pick<
    SalaRow,
    "id" | "nombre" | "activa"
  > | null;

  if (!sala) {
    return {
      ok: false,
      error: "La sala no existe.",
    };
  }

  if (!sala.activa) {
    return {
      ok: false,
      error: "La sala ya está desactivada.",
    };
  }

  const { error } = await admin
    .from("sala")
    .update({
      activa: false,
    })
    .eq("id", id);

  if (error) {
    return {
      ok: false,
      error: `No se pudo desactivar la sala: ${error.message}`,
    };
  }

  revalidarSalas();

  return { ok: true };
}

/**
 * SCRUM-124: eliminar una sala (baja lógica, nunca un DELETE).
 *
 * Marca `activa = false` y `eliminada = true` para que la sala desaparezca
 * del listado del panel, y desactiva en cascada todas sus funciones activas
 * (`funcion.activa = false`). Las filas se conservan por auditoría y para no
 * invalidar reservas o boletos ya emitidos.
 */
export async function eliminarSala(
  id: number,
): Promise<ActionResult> {
  const denied = await assertAdmin();

  if (denied) {
    return {
      ok: false,
      error: denied,
    };
  }

  if (!Number.isInteger(id) || id <= 0) {
    return {
      ok: false,
      error: "Sala inválida.",
    };
  }

  const admin = createAdminClient();

  // Validar que la sala exista y no esté ya eliminada.
  const { data: sala, error: lecturaError } = await admin
    .from("sala")
    .select("id, nombre, activa, eliminada")
    .eq("id", id)
    .maybeSingle();

  if (lecturaError) {
    return {
      ok: false,
      error: `No se pudo consultar la sala: ${lecturaError.message}`,
    };
  }

  if (!sala) {
    return {
      ok: false,
      error: "La sala no existe.",
    };
  }

  const s = sala as Pick<
    SalaRow,
    "id" | "nombre" | "activa" | "eliminada"
  > | null;

  if (!s || s.eliminada) {
    return {
      ok: false,
      error: "La sala ya está eliminada.",
    };
  }

  // Cascada: desactivar todas las funciones activas de esta sala.
  const { error: errFunciones } = await admin
    .from("funcion")
    .update({ activa: false })
    .eq("id_sala", id);

  if (errFunciones) {
    return {
      ok: false,
      error: `No se pudieron desactivar las funciones de la sala: ${errFunciones.message}`,
    };
  }

  // Marcar la sala como eliminada (baja lógica).
  const { error } = await admin
    .from("sala")
    .update({
      activa: false,
      eliminada: true,
    })
    .eq("id", id);

  if (error) {
    return {
      ok: false,
      error: `No se pudo eliminar la sala: ${error.message}`,
    };
  }

  revalidarSalas();

  return { ok: true };
}

/**
 * SCRUM-109: reactivar una sala (interruptor de Estado del panel).
 *
 * Camino inverso de `desactivarSala`: la fila nunca se borró, solo estaba
 * apagada, así que vuelve a estar disponible para funciones nuevas. El límite
 * de 10 salas activas también aplica aquí: con 10 activas no se reactiva.
 */
export async function activarSala(
  id: number,
): Promise<ActionResult> {
  const denied = await assertAdmin();

  if (denied) {
    return {
      ok: false,
      error: denied,
    };
  }

  if (!Number.isInteger(id) || id <= 0) {
    return {
      ok: false,
      error: "Sala inválida.",
    };
  }

  const admin = createAdminClient();

  const { data, error: lecturaError } = await admin
    .from("sala")
    .select("id, nombre, activa")
    .eq("id", id)
    .maybeSingle();

  if (lecturaError) {
    return {
      ok: false,
      error: `No se pudo consultar la sala: ${lecturaError.message}`,
    };
  }

  const sala = data as Pick<
    SalaRow,
    "id" | "nombre" | "activa"
  > | null;

  if (!sala) {
    return {
      ok: false,
      error: "La sala no existe.",
    };
  }

  if (sala.activa) {
    return {
      ok: false,
      error: "La sala ya está activa.",
    };
  }

  /*
   * Mismo límite que al crear: 10 salas activas como máximo. Otro
   * administrador pudo haber llenado el cupo mientras esta sala estaba
   * apagada, así que se vuelve a contar en el servidor.
   */
  const activas = await contarSalasActivas();

  if (activas >= 10) {
    return {
      ok: false,
      error: "Se alcanzó el máximo de 10 salas activas.",
    };
  }

  const { error } = await admin
    .from("sala")
    .update({
      activa: true,
    })
    .eq("id", id);

  if (error) {
    return {
      ok: false,
      error: `No se pudo activar la sala: ${error.message}`,
    };
  }

  revalidarSalas();

  return { ok: true };
}

/* =====================================================================
 * SCRUM-121: precios de una sala por tipo de entrada.
 * ===================================================================== */

/**
 * Un precio del formulario: obligatorio, número mayor que 0, hasta 999.99 y con
 * máximo 2 decimales. Llega como texto para poder revisar los decimales tal
 * como se escribieron.
 */
const precio = (nombre: string) =>
  z
    .string({ required_error: `El precio de ${nombre} es obligatorio.` })
    .regex(
      /^-?\d+(\.\d{1,2})?$/,
      `El precio de ${nombre} debe ser un número con máximo 2 decimales.`,
    )
    .transform(Number)
    .refine((v) => v > 0, `El precio de ${nombre} debe ser mayor que 0.`)
    .refine((v) => v <= 999.99, `El precio de ${nombre} no puede pasar de Q999.99.`);

const nombreEntrada = (id: TipoEntradaId) =>
  TIPOS_ENTRADA.find((t) => t.id === id)?.nombre ?? id;

const preciosSchema = z.object({
  adulto: precio(nombreEntrada("adulto")),
  tercera: precio(nombreEntrada("tercera")),
  ninos: precio(nombreEntrada("ninos")),
});

/**
 * SCRUM-121: guardar los precios (Adulto, 3ra. Edad, Niños) de una sala.
 * Solo el Administrador; el Colaborador ve el modal en modo consulta.
 */
export async function guardarPreciosSala(
  id: number,
  formData: FormData,
): Promise<ActionResult> {
  const denied = await assertAdmin();

  if (denied) {
    return { ok: false, error: denied };
  }

  if (!Number.isInteger(id) || id <= 0) {
    return { ok: false, error: "Sala inválida." };
  }

  const parsed = preciosSchema.safeParse(
    Object.fromEntries(TIPOS_ENTRADA.map((t) => [t.id, campo(formData, t.id)])),
  );

  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Los precios no son válidos.",
    };
  }

  const admin = createAdminClient();

  const actual = await admin.from("sala").select("id").eq("id", id).maybeSingle();

  if (actual.error) {
    return {
      ok: false,
      error: `No se pudo consultar la sala: ${actual.error.message}`,
    };
  }

  if (!actual.data) {
    return { ok: false, error: "La sala no existe." };
  }

  const { error } = await admin.from("sala").update(filaPrecios(parsed.data)).eq("id", id);

  if (error) {
    return {
      ok: false,
      error:
        error.code === "42703"
          ? SIN_COLUMNAS_PRECIO
          : `No se pudieron guardar los precios: ${error.message}`,
    };
  }

  revalidarSalas();

  return { ok: true };
}

/* =====================================================================
 * SCRUM-110: configuración de asientos de una sala.
 *
 * Guarda el plano físico completo (filas × columnas) de una sala. Cada
 * celda queda en la tabla `asiento` con estado normal | pasillo |
 * deshabilitado. Es un borrado + reinserción de todo el plano, así que
 * solo se permite cuando la sala NO tiene funciones activas (para no
 * invalidar asientos de una función futura).
 *
 * Al terminar, recalcula `sala.capacidad` = cantidad de asientos "normal"
 * (los pasillos y deshabilitados no cuentan), que es lo que pide el
 * criterio 4 del ticket. Mientras la sala no tenga plano, la capacidad
 * sigue siendo la que se escribió a mano en el formulario de sala.
 * ===================================================================== */

/** Letra de fila a partir del índice 0-based: 0 -> "A", 25 -> "Z". */
const letraFila = (indice: number) => String.fromCharCode(65 + indice);

const MAX_FILAS = 14; // A..N
const MAX_COLUMNAS = 25;
/** Capacidad máxima por sala (regla de negocio del proyecto). */
const CAPACIDAD_MAXIMA = 200;

export async function guardarDistribucionAsientos(input: {
  idSala: number;
  filas: number;
  columnas: number;
  /** estado por celda, indexado por `${fila}-${numero}` (fila ya en letra). */
  celdas: Record<string, EstadoAsiento>;
}): Promise<ActionResult> {
  const denied = await assertAdmin();

  if (denied) {
    return { ok: false, error: denied };
  }

  const { idSala, filas, columnas, celdas } = input;

  if (!Number.isInteger(idSala) || idSala <= 0) {
    return { ok: false, error: "Sala inválida." };
  }

  if (
    !Number.isInteger(filas) ||
    !Number.isInteger(columnas) ||
    filas < 1 ||
    filas > MAX_FILAS ||
    columnas < 1 ||
    columnas > MAX_COLUMNAS
  ) {
    return {
      ok: false,
      error: `La cuadrícula debe tener entre 1 y ${MAX_FILAS} filas y entre 1 y ${MAX_COLUMNAS} columnas.`,
    };
  }

  const admin = createAdminClient();

  // La sala debe existir.
  const { data: sala, error: lecturaError } = await admin
    .from("sala")
    .select("id, nombre")
    .eq("id", idSala)
    .maybeSingle();

  if (lecturaError) {
    return {
      ok: false,
      error: `No se pudo consultar la sala: ${lecturaError.message}`,
    };
  }

  if (!sala) {
    return { ok: false, error: "La sala no existe." };
  }

  // Regla: no se re-configura el plano si la sala tiene funciones activas.
  const tieneFunciones = await salaTieneFuncionesActivas(idSala);

  if (tieneFunciones) {
    return {
      ok: false,
      error:
        "Esta sala tiene funciones activas. Cancélalas o desactívalas antes de modificar la distribución.",
    };
  }

  // Construye el plano completo a partir de la cuadrícula recibida.
  const plano: Array<{
    id_sala: number;
    fila: string;
    numero: number;
    estado: EstadoAsiento;
  }> = [];

  for (let f = 0; f < filas; f++) {
    const letra = letraFila(f);

    for (let n = 1; n <= columnas; n++) {
      const estado = celdas[`${letra}-${n}`] ?? "normal";
      plano.push({ id_sala: idSala, fila: letra, numero: n, estado });
    }
  }

  // Recalcula la capacidad = cantidad de asientos "normal".
  const disponibles = plano.filter((a) => a.estado === "normal").length;

  // Regla de negocio: el límite de 200 es sobre asientos disponibles.
  if (disponibles > CAPACIDAD_MAXIMA) {
    return {
      ok: false,
      error: `La sala no permite más de ${CAPACIDAD_MAXIMA} asientos disponibles (hay ${disponibles}).`,
    };
  }

  // Borra el plano anterior y escribe el nuevo (borrado + reinserción).
  const { error: borradoError } = await admin
    .from("asiento")
    .delete()
    .eq("id_sala", idSala);

  if (borradoError) {
    return {
      ok: false,
      error: `No se pudo limpiar la distribución anterior: ${borradoError.message}`,
    };
  }

  const { error: insercionError } = await admin.from("asiento").insert(plano);

  if (insercionError) {
    return {
      ok: false,
      error: `No se pudo guardar la distribución: ${insercionError.message}`,
    };
  }

  const { error: capacidadError } = await admin
    .from("sala")
    .update({ capacidad: disponibles })
    .eq("id", idSala);

  if (capacidadError) {
    return {
      ok: false,
      error: `No se pudo actualizar la capacidad: ${capacidadError.message}`,
    };
  }

  revalidarSalas();
  revalidatePath(`/admin/salas/${idSala}/asientos`);

  return { ok: true };
}