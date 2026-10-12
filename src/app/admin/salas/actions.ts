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
import { createAdminClient } from "@/lib/supabase/admin";
import type { SalaRow } from "@/lib/db-types";

export type ActionResult =
  | { ok: true }
  | { ok: false; error: string };

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

/**
 * Reglas del formulario.
 *
 * - nombre obligatorio
 * - tipo obligatorio y limitado a los definidos en la historia
 * - capacidad entera y mayor que cero
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

  capacidad: z.coerce
    .number({
      invalid_type_error: "La capacidad debe ser un número.",
    })
    .int("La capacidad debe ser un número entero.")
    .positive("La capacidad debe ser mayor que cero."),
});

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
    capacidad: campo(formData, "capacidad"),
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

  const { nombre, tipo, capacidad } = validacion.datos;

  const { error } = await createAdminClient()
    .from("sala")
    .insert({
      nombre,
      tipo_sala: tipo,
      capacidad,
      activa: true,
    });

  if (error) {
    return {
      ok: false,
      error: `No se pudo registrar la sala: ${error.message}`,
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

  const { nombre, tipo, capacidad } = validacion.datos;

  const { error } = await admin
    .from("sala")
    .update({
      nombre,
      tipo_sala: tipo,
      capacidad,
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