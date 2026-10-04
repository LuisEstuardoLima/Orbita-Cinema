import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { addDays } from "date-fns";
import { ahoraGuatemala, parseFecha, toFecha } from "@/lib/fechas";
import type { FuncionRow, PeliculaRow, SalaRow } from "@/lib/db-types";
import type { FuncionVM, PeliculaVM } from "@/lib/cartelera";

/** Días (contando hoy) que muestra el detalle de una película. */
const DIAS_DETALLE = 7;

const vacio = (v: string | null | undefined) => v?.trim() || "";

function aFuncionVM(f: FuncionRow, s: SalaRow): FuncionVM {
  return {
    id: f.id,
    fecha: f.fecha,
    hora: f.hora.slice(0, 5),
    idioma: f.idioma ?? "",
    subtitulos: f.subtitulos ?? false,
    formato: f.idioma ? `${f.subtitulos ? "Subtitulada" : "Doblada"} ${f.idioma}` : "",
    sala: { id: s.id, nombre: s.nombre, tipo: s.tipo_sala ?? "" },
  };
}

function aPeliculaVM(p: PeliculaRow, funciones: FuncionVM[]): PeliculaVM {
  return {
    id: p.id,
    slug: p.slug,
    titulo: p.titulo,
    clasificacion: p.clasificacion,
    genero: vacio(p.genero),
    sinopsis: vacio(p.sinopsis),
    posterUrl: p.poster_url,
    director: vacio(p.director),
    actor: vacio(p.actores) || vacio(p.actor_principal),
    estudio: vacio(p.estudio),
    funciones,
  };
}

/** Funciones que todavía no han empezado (hora de Guatemala). */
const vigente = (f: FuncionRow, ahora: { fecha: string; hora: string }) =>
  f.fecha > ahora.fecha || (f.fecha === ahora.fecha && f.hora.slice(0, 5) >= ahora.hora);

/** SCRUM-11/12/13/14: películas activas con sus próximas funciones. */
export async function getCartelera(): Promise<{ hoy: string; peliculas: PeliculaVM[] }> {
  const supabase = await createClient();
  const ahora = ahoraGuatemala();

  const [pel, fun, sal] = await Promise.all([
    supabase.from("pelicula").select("*").eq("activa", true).order("id"),
    supabase
      .from("funcion")
      .select("*")
      .eq("activa", true)
      .gte("fecha", ahora.fecha)
      .order("fecha")
      .order("hora"),
    supabase.from("sala").select("*").eq("activa", true),
  ]);
  if (pel.error) throw new Error(`pelicula: ${pel.error.message}`);
  if (fun.error) throw new Error(`funcion: ${fun.error.message}`);
  if (sal.error) throw new Error(`sala: ${sal.error.message}`);

  const salas = new Map((sal.data as SalaRow[]).map((s) => [s.id, s]));
  const porPelicula = new Map<number, FuncionVM[]>();
  for (const f of fun.data as FuncionRow[]) {
    const sala = f.id_sala == null ? undefined : salas.get(f.id_sala);
    if (!sala || f.id_pelicula == null || !vigente(f, ahora)) continue; // sala deshabilitada, sin película o función ya iniciada
    const lista = porPelicula.get(f.id_pelicula) ?? [];
    lista.push(aFuncionVM(f, sala));
    porPelicula.set(f.id_pelicula, lista);
  }

  return {
    hoy: ahora.fecha,
    peliculas: (pel.data as PeliculaRow[]).map((p) =>
      aPeliculaVM(p, porPelicula.get(p.id) ?? []),
    ),
  };
}

/** SCRUM-15/17/101: una película con sus funciones de los próximos DIAS_DETALLE días. */
export const getPeliculaBySlug = cache(async (slug: string): Promise<PeliculaVM | null> => {
  const supabase = await createClient();
  const ahora = ahoraGuatemala();
  const hasta = toFecha(addDays(parseFecha(ahora.fecha), DIAS_DETALLE - 1));

  const pel = await supabase
    .from("pelicula")
    .select("*")
    .eq("slug", slug)
    .eq("activa", true)
    .maybeSingle();
  if (pel.error) throw new Error(`pelicula: ${pel.error.message}`);
  if (!pel.data) return null;
  const pelicula = pel.data as PeliculaRow;

  const [fun, sal] = await Promise.all([
    supabase
      .from("funcion")
      .select("*")
      .eq("id_pelicula", pelicula.id)
      .eq("activa", true)
      .gte("fecha", ahora.fecha)
      .lte("fecha", hasta)
      .order("fecha")
      .order("hora"),
    supabase.from("sala").select("*").eq("activa", true),
  ]);
  if (fun.error) throw new Error(`funcion: ${fun.error.message}`);
  if (sal.error) throw new Error(`sala: ${sal.error.message}`);

  const salas = new Map((sal.data as SalaRow[]).map((s) => [s.id, s]));
  const funciones: FuncionVM[] = [];
  for (const f of fun.data as FuncionRow[]) {
    const sala = f.id_sala == null ? undefined : salas.get(f.id_sala);
    if (sala && vigente(f, ahora)) funciones.push(aFuncionVM(f, sala));
  }
  return aPeliculaVM(pelicula, funciones);
});

/** SCRUM-104: listado del panel admin (service role: no depende de las políticas RLS). */
export async function listPeliculasAdmin(): Promise<PeliculaRow[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("pelicula")
    .select("*")
    .eq("activa", true)
    .order("id");
  if (error) throw new Error(`pelicula: ${error.message}`);
  return data as PeliculaRow[];
}
