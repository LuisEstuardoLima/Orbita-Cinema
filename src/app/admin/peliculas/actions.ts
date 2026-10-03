"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { assertAdmin } from "@/lib/auth/guard";
import { slugify } from "@/lib/slug";
import { CLASIFICACIONES, GENEROS } from "@/lib/cartelera";

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
 * SCRUM-106: "eliminar" = dar de baja (activa = false), como pide RF-056.
 * Un DELETE real rompería las funciones y, más adelante, las reservas que referencian la película.
 */
export async function eliminarPelicula(id: number): Promise<ActionResult> {
  const denied = await assertAdmin();
  if (denied) return { ok: false, error: denied };
  if (!Number.isInteger(id) || id <= 0) return { ok: false, error: "Película inválida." };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("pelicula")
    .update({ activa: false })
    .eq("id", id)
    .select("id");
  if (error) return { ok: false, error: `No se pudo dar de baja: ${error.message}` };
  if (!data || data.length === 0) return { ok: false, error: "La película no existe." };

  revalidatePath("/");
  revalidatePath("/admin/peliculas");
  return { ok: true };
}
