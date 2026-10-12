"use server";

/**
 * SCRUM-111: Server Actions de /admin/funciones (crear, editar y cancelar funciones).
 *
 * Las usan Administrador y Colaborador (`assertRol`). Toda regla de negocio se valida aquí,
 * en el servidor, aunque el formulario ya la limite: fechas futuras, película y sala activas,
 * idioma de la lista de la cartelera y que la sala no tenga otra función que se cruce.
 *
 * Cancelar es una baja lógica (`activa = false`), nunca un DELETE: más adelante las reservas y
 * los boletos van a referenciar a la función.
 */
import { revalidatePath } from "next/cache";
import { format } from "date-fns";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertRol } from "@/lib/auth/guard";
import { IDIOMAS_FILTRO } from "@/lib/cartelera";
import { buscarCruce, DURACION_DEFECTO_MIN } from "@/lib/db/funciones";
import { ahoraGuatemala, parseFecha, toFecha } from "@/lib/fechas";
import type { FuncionRow, PeliculaRow, SalaRow } from "@/lib/db-types";
import type { Rol } from "@/lib/roles";

export type ActionResult = { ok: true } | { ok: false; error: string };

const ROLES: Rol[] = ["Administrador", "Colaborador"];

const schema = z.object({
  idPelicula: z.coerce
    .number({ invalid_type_error: "Elige una película." })
    .int()
    .positive("Elige una película."),
  idSala: z.coerce
    .number({ invalid_type_error: "Elige una sala." })
    .int()
    .positive("Elige una sala."),
  fecha: z
    .string({ required_error: "La fecha es obligatoria." })
    .regex(/^\d{4}-\d{2}-\d{2}$/, "La fecha no es válida.")
    .refine((f) => toFecha(parseFecha(f)) === f, "La fecha no es válida."),
  hora: z
    .string({ required_error: "La hora es obligatoria." })
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "La hora no es válida."),
  // La hora llega de dos selects (minutos de 5 en 5); aquí solo se valida el formato.
  idioma: z.enum(IDIOMAS_FILTRO, { errorMap: () => ({ message: "Elige un idioma." }) }),
  subtitulos: z.boolean(),
});

const campo = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
};

/** true si la función (fecha + hora) ya empezó o es del pasado, en hora de Guatemala. */
const yaEmpezo = (fecha: string, hora: string) => {
  const ahora = ahoraGuatemala();
  return `${fecha} ${hora.slice(0, 5)}` <= `${ahora.fecha} ${ahora.hora}`;
};

/** La cartelera y el detalle de todas las películas (el slug no importa: es la plantilla). */
function revalidarCartelera() {
  revalidatePath("/");
  revalidatePath("/pelicula/[slug]", "page");
  revalidatePath("/admin/funciones");
}

type DatosFuncion = z.infer<typeof schema>;

/** Validaciones comunes de crear y editar. `excluirId` = la función que se está editando. */
async function validar(
  formData: FormData,
  excluirId?: number,
): Promise<{ ok: true; datos: DatosFuncion } | { ok: false; error: string }> {
  const parsed = schema.safeParse({
    idPelicula: campo(formData, "idPelicula"),
    idSala: campo(formData, "idSala"),
    fecha: campo(formData, "fecha"),
    hora: campo(formData, "hora"),
    idioma: campo(formData, "idioma"),
    subtitulos: formData.get("subtitulos") === "on",
  });
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  const d = parsed.data;

  if (yaEmpezo(d.fecha, d.hora)) {
    return { ok: false, error: "No se puede programar una función en una fecha u hora pasada." };
  }

  // Película y sala se releen de la base: el formulario pudo quedar abierto mientras alguien
  // las desactivaba.
  const admin = createAdminClient();
  const [pel, sal] = await Promise.all([
    admin
      .from("pelicula")
      .select("id, activa, eliminada, duracion_min")
      .eq("id", d.idPelicula)
      .maybeSingle(),
    admin.from("sala").select("id, nombre, activa").eq("id", d.idSala).maybeSingle(),
  ]);
  if (pel.error)
    return { ok: false, error: `No se pudo validar la película: ${pel.error.message}` };
  if (sal.error) return { ok: false, error: `No se pudo validar la sala: ${sal.error.message}` };
  const pelicula = pel.data as Pick<PeliculaRow, "activa" | "eliminada" | "duracion_min"> | null;
  const sala = sal.data as Pick<SalaRow, "nombre" | "activa"> | null;
  if (!pelicula || !pelicula.activa || pelicula.eliminada) {
    return { ok: false, error: "La película elegida no está activa." };
  }
  if (!sala || !sala.activa) return { ok: false, error: "La sala elegida no está activa." };

  try {
    const cruce = await buscarCruce({
      idSala: d.idSala,
      fecha: d.fecha,
      hora: d.hora,
      duracionMin: pelicula.duracion_min ?? DURACION_DEFECTO_MIN,
      excluirId,
    });
    if (cruce) {
      const dia = format(parseFecha(cruce.fecha), "dd/MM");
      return {
        ok: false,
        error: `${sala.nombre} ya tiene «${cruce.pelicula}» el ${dia} de ${cruce.inicio} a ${cruce.fin} (incluye limpieza). Elige otra hora o sala.`,
      };
    }
  } catch (e) {
    return { ok: false, error: `No se pudo validar el horario: ${(e as Error).message}` };
  }

  return { ok: true, datos: d };
}

/** Lee una función para editarla o cancelarla: debe existir, estar activa y no haber empezado. */
async function funcionModificable(
  id: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!Number.isInteger(id) || id <= 0) return { ok: false, error: "Función inválida." };
  const { data, error } = await createAdminClient()
    .from("funcion")
    .select("id, fecha, hora, activa")
    .eq("id", id)
    .maybeSingle();
  if (error) return { ok: false, error: `No se pudo leer la función: ${error.message}` };
  const f = data as Pick<FuncionRow, "fecha" | "hora" | "activa"> | null;
  if (!f) return { ok: false, error: "La función no existe." };
  if (!f.activa) return { ok: false, error: "La función ya está cancelada." };
  if (yaEmpezo(f.fecha, f.hora)) return { ok: false, error: "La función ya empezó o ya pasó." };
  // TODO Sprint 3: cuando existan las reservas, impedir editar o cancelar una función que ya
  // tenga reservas o boletos vendidos (avisar al usuario en lugar de modificarla).
  return { ok: true };
}

const fila = (d: DatosFuncion) => ({
  id_pelicula: d.idPelicula,
  id_sala: d.idSala,
  fecha: d.fecha,
  hora: d.hora,
  idioma: d.idioma,
  subtitulos: d.subtitulos,
});

/** SCRUM-111: programar una función nueva. */
export async function crearFuncion(formData: FormData): Promise<ActionResult> {
  const denied = await assertRol(ROLES);
  if (denied) return { ok: false, error: denied };

  const v = await validar(formData);
  if (!v.ok) return v;

  const { error } = await createAdminClient()
    .from("funcion")
    .insert({ ...fila(v.datos), activa: true });
  if (error) return { ok: false, error: `No se pudo guardar la función: ${error.message}` };

  revalidarCartelera();
  return { ok: true };
}

/** SCRUM-111: modificar película, sala, fecha, hora, idioma o subtítulos de una función. */
export async function editarFuncion(id: number, formData: FormData): Promise<ActionResult> {
  const denied = await assertRol(ROLES);
  if (denied) return { ok: false, error: denied };

  const actual = await funcionModificable(id);
  if (!actual.ok) return actual;

  const v = await validar(formData, id);
  if (!v.ok) return v;

  const { error } = await createAdminClient().from("funcion").update(fila(v.datos)).eq("id", id);
  if (error) return { ok: false, error: `No se pudo guardar la función: ${error.message}` };

  revalidarCartelera();
  return { ok: true };
}

/** SCRUM-111: cancelar una función (baja lógica: `activa = false`). */
export async function cancelarFuncion(id: number): Promise<ActionResult> {
  const denied = await assertRol(ROLES);
  if (denied) return { ok: false, error: denied };

  const actual = await funcionModificable(id);
  if (!actual.ok) return actual;

  const { error } = await createAdminClient()
    .from("funcion")
    .update({ activa: false })
    .eq("id", id);
  if (error) return { ok: false, error: `No se pudo cancelar la función: ${error.message}` };

  revalidarCartelera();
  return { ok: true };
}
