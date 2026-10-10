"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertAdmin } from "@/lib/auth/guard";
import { slugify } from "@/lib/slug";
import { CLASIFICACIONES, GENEROS, normalizar } from "@/lib/cartelera";

export type ActionResult = { ok: true } | { ok: false; error: string };

const MAX_POSTER_BYTES = 4 * 1024 * 1024; // límite de cuerpo de una función en Vercel ≈ 4.5 MB
const POSTER_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const schema = z.object({
  titulo: z
    .string({ required_error: "El título es obligatorio." })
    .trim()
    .min(1, "El título es obligatorio.")
    .max(150, "El título es demasiado largo."),
  clasificacion: z.enum(CLASIFICACIONES, { errorMap: () => ({ message: "Elige una clasificación." }) }),
  genero: z.enum(GENEROS, { errorMap: () => ({ message: "Elige un género." }) }),
  sinopsis: z
    .string({ required_error: "La descripción es obligatoria." })
    .trim()
    .min(10, "La descripción debe tener al menos 10 caracteres.")
    .max(2000, "La descripción es demasiado larga."),
  director: z.string().trim().max(100).optional(),
  actores: z.string().trim().max(100).optional(),
  estudio: z.string().trim().max(100).optional(),
});

const campo = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === "string" && v.trim() ? v : undefined;
};

/** SCRUM-103: registrar una película nueva (con póster opcional en Supabase Storage). */
export async function crearPelicula(formData: FormData): Promise<ActionResult> {
  const denied = await assertAdmin();
  if (denied) return { ok: false, error: denied };

  const parsed = schema.safeParse({
    titulo: campo(formData, "titulo"),
    clasificacion: campo(formData, "clasificacion"),
    genero: campo(formData, "genero"),
    sinopsis: campo(formData, "sinopsis"),
    director: campo(formData, "director"),
    actores: campo(formData, "actores"),
    estudio: campo(formData, "estudio"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  const d = parsed.data;

  const admin = createAdminClient();

  // Una película activa con el mismo título no se puede volver a registrar: se avisa aquí
  // para que la activen o la modifiquen en lugar de dejar dos cartas con el mismo nombre.
  const { data: homonimas, error: errDup } = await admin
    .from("pelicula")
    .select("id, titulo")
    .eq("activa", true)
    .ilike("titulo", d.titulo);
  if (errDup) return { ok: false, error: `No se pudo validar el título: ${errDup.message}` };
  const repetida = (homonimas ?? []).find(
    (p: { titulo: string }) => normalizar(p.titulo) === normalizar(d.titulo),
  );
  if (repetida) {
    return {
      ok: false,
      error: `Ya existe "${repetida.titulo}". Actívala o modifícala en lugar de crear otra.`,
    };
  }

  // slug único: base, base-2, base-3...
  const base = slugify(d.titulo) || "pelicula";
  const { data: existentes, error: errSlug } = await admin
    .from("pelicula")
    .select("slug")
    .like("slug", `${base}%`);
  if (errSlug) return { ok: false, error: `No se pudo validar el título: ${errSlug.message}` };
  const usados = new Set((existentes ?? []).map((r: { slug: string }) => r.slug));
  let slug = base;
  for (let n = 2; usados.has(slug); n++) slug = `${base}-${n}`;

  // póster (opcional)
  let posterPath: string | null = null;
  let posterUrl: string | null = null;
  const poster = formData.get("poster");
  if (poster instanceof File && poster.size > 0) {
    const ext = POSTER_TYPES[poster.type];
    if (!ext) return { ok: false, error: "El póster debe ser JPG, PNG o WEBP." };
    if (poster.size > MAX_POSTER_BYTES) return { ok: false, error: "El póster no puede pasar de 4 MB." };
    posterPath = `${slug}-${Date.now()}.${ext}`;
    const subida = await admin.storage
      .from("posters")
      .upload(posterPath, poster, { contentType: poster.type, upsert: false });
    if (subida.error) return { ok: false, error: `No se pudo subir el póster: ${subida.error.message}` };
    posterUrl = admin.storage.from("posters").getPublicUrl(posterPath).data.publicUrl;
  }

  const { error } = await admin.from("pelicula").insert({
    slug,
    titulo: d.titulo,
    clasificacion: d.clasificacion,
    genero: d.genero,
    sinopsis: d.sinopsis,
    director: d.director ?? null,
    actores: d.actores ?? null,
    estudio: d.estudio ?? null,
    poster_url: posterUrl,
    activa: true,
  });
  if (error) {
    if (posterPath) await admin.storage.from("posters").remove([posterPath]);
    return { ok: false, error: `No se pudo guardar la película: ${error.message}` };
  }

  revalidatePath("/");
  revalidatePath("/admin/peliculas");
  return { ok: true };
}

/**
 * SCRUM-106: activa o desactiva una película.
 *
 * "Dar de baja" es una baja lógica (`activa = false`), nunca un DELETE: las funciones, y más
 * adelante las reservas y los boletos, referencian a la película y un borrado real rompería
 * esos datos. Un boleto ya vendido tiene que seguir siendo válido aunque la película se
 * desactive después; la baja solo impide vender nuevas entradas.
 *
 * El listado del panel trae también las inactivas, así que esta misma acción las revierte:
 * una baja nunca deja una película inaccesible desde la aplicación.
 */
export async function cambiarEstadoPelicula(
  id: number,
  activa: boolean,
): Promise<ActionResult> {
  const denied = await assertAdmin();
  if (denied) return { ok: false, error: denied };
  if (!Number.isInteger(id) || id <= 0) return { ok: false, error: "Película inválida." };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("pelicula")
    .update({ activa })
    .eq("id", id)
    .select("id, titulo, activa")
    .maybeSingle();
  if (error) return { ok: false, error: `No se pudo cambiar el estado: ${error.message}` };
  if (!data) return { ok: false, error: "La película no existe." };

  revalidatePath("/");
  revalidatePath("/admin/peliculas");
  return { ok: true };
}

/**
 * SCRUM-106 (botón "Eliminar" del panel): baja lógica + ocultado del listado admin.
 *
 * A diferencia de `cambiarEstadoPelicula` (interruptor de Estado), esta acción marca también
 * `eliminada = true`, y `listPeliculasAdmin()` filtra esas filas: la película desaparece del
 * panel pero sigue existiendo en la base (referencias de funciones/reservas intactas).
 * `activa = false` además la saca de la cartelera pública, como cualquier otra baja.
 */
export async function eliminarPelicula(id: number): Promise<ActionResult> {
  const denied = await assertAdmin();
  if (denied) return { ok: false, error: denied };
  if (!Number.isInteger(id) || id <= 0) return { ok: false, error: "Película inválida." };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("pelicula")
    .update({ activa: false, eliminada: true })
    .eq("id", id)
    .select("id, titulo")
    .maybeSingle();
  if (error) return { ok: false, error: `No se pudo eliminar: ${error.message}` };
  if (!data) return { ok: false, error: "La película no existe." };

  revalidatePath("/");
  revalidatePath("/admin/peliculas");
  return { ok: true };
}

/** Ruta del archivo dentro del bucket `posters`, o null si la URL no es de nuestro Storage. */
function rutaEnBucket(url: string | null): string | null {
  if (!url) return null;
  const marca = "/storage/v1/object/public/posters/";
  const i = url.indexOf(marca);
  if (i === -1) return null; // p. ej. un enlace externo de prueba: no es nuestro, no se borra
  return decodeURIComponent(url.slice(i + marca.length).split("?")[0] ?? "") || null;
}

/**
 * SCRUM-108: modificar los datos de una película ya registrada.
 *
 * - Solo se puede editar una película DESACTIVADA (`activa = false`): una película a la venta no
 *   se modifica. Esta es la validación que cuenta; la interfaz solo avisa, pero cualquiera
 *   podría invocar la acción directamente. Editar no cambia `activa`: eso solo lo hace el
 *   interruptor del panel.
 * - El `slug` NO se recalcula aunque cambie el título: es la URL pública (`/pelicula/[slug]`) y
 *   cambiarlo rompería los enlaces ya compartidos.
 * - Póster nuevo: se sube primero, luego se actualiza la fila y por último se borra el anterior.
 *   Así, si algo falla a medias, la película nunca se queda sin imagen. Sin archivo nuevo, el
 *   póster actual se conserva.
 */
export async function actualizarPelicula(id: number, formData: FormData): Promise<ActionResult> {
  const denied = await assertAdmin();
  if (denied) return { ok: false, error: denied };
  if (!Number.isInteger(id) || id <= 0) return { ok: false, error: "Película inválida." };

  const parsed = schema.safeParse({
    titulo: campo(formData, "titulo"),
    clasificacion: campo(formData, "clasificacion"),
    genero: campo(formData, "genero"),
    sinopsis: campo(formData, "sinopsis"),
    director: campo(formData, "director"),
    actores: campo(formData, "actores"),
    estudio: campo(formData, "estudio"),
  });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos." };
  const d = parsed.data;

  const admin = createAdminClient();

  const { data: actual, error: errActual } = await admin
    .from("pelicula")
    .select("id, slug, titulo, poster_url, activa, eliminada")
    .eq("id", id)
    .maybeSingle();
  if (errActual) return { ok: false, error: `No se pudo leer la película: ${errActual.message}` };
  if (!actual || actual.eliminada) return { ok: false, error: "La película no existe." };
  if (actual.activa) {
    return {
      ok: false,
      error: "Solo se puede editar una película desactivada. Desactívala primero desde el interruptor de Estado.",
    };
  }

  // Mismo criterio que al registrar: no puede haber dos películas ACTIVAS con el mismo título.
  // Solo se revisa si el título cambió; así una película inactiva cuyo título ya usa otra activa
  // (caso permitido al registrar) se puede seguir editando sin tocar el título.
  if (normalizar(d.titulo) !== normalizar(actual.titulo)) {
    const { data: homonimas, error: errDup } = await admin
      .from("pelicula")
      .select("id, titulo")
      .eq("activa", true)
      .neq("id", id)
      .ilike("titulo", d.titulo);
    if (errDup) return { ok: false, error: `No se pudo validar el título: ${errDup.message}` };
    const repetida = (homonimas ?? []).find(
      (p: { titulo: string }) => normalizar(p.titulo) === normalizar(d.titulo),
    );
    if (repetida) return { ok: false, error: `Ya existe una película activa llamada "${repetida.titulo}".` };
  }

  // póster nuevo (opcional)
  let posterNuevoPath: string | null = null;
  let posterNuevoUrl: string | null = null;
  const poster = formData.get("poster");
  if (poster instanceof File && poster.size > 0) {
    const ext = POSTER_TYPES[poster.type];
    if (!ext) return { ok: false, error: "El póster debe ser JPG, PNG o WEBP." };
    if (poster.size > MAX_POSTER_BYTES) return { ok: false, error: "El póster no puede pasar de 4 MB." };
    posterNuevoPath = `${actual.slug}-${Date.now()}.${ext}`;
    const subida = await admin.storage
      .from("posters")
      .upload(posterNuevoPath, poster, { contentType: poster.type, upsert: false });
    if (subida.error) return { ok: false, error: `No se pudo subir el póster: ${subida.error.message}` };
    posterNuevoUrl = admin.storage.from("posters").getPublicUrl(posterNuevoPath).data.publicUrl;
  }

  const { data: guardada, error } = await admin
    .from("pelicula")
    .update({
      titulo: d.titulo,
      clasificacion: d.clasificacion,
      genero: d.genero,
      sinopsis: d.sinopsis,
      director: d.director ?? null,
      actores: d.actores ?? null,
      estudio: d.estudio ?? null,
      ...(posterNuevoUrl ? { poster_url: posterNuevoUrl } : {}),
    })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error || !guardada) {
    if (posterNuevoPath) await admin.storage.from("posters").remove([posterNuevoPath]);
    return {
      ok: false,
      error: error ? `No se pudo guardar los cambios: ${error.message}` : "La película no existe.",
    };
  }

  // El póster anterior ya no se usa: se borra de Storage (si era nuestro). Si falla no importa
  // para el usuario, solo queda un archivo huérfano.
  if (posterNuevoUrl) {
    const anterior = rutaEnBucket(actual.poster_url);
    if (anterior) await admin.storage.from("posters").remove([anterior]);
  }

  revalidatePath("/");
  revalidatePath("/admin/peliculas");
  revalidatePath(`/pelicula/${actual.slug}`);
  return { ok: true };
}
