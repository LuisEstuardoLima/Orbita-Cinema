/** Tipos y lógica pura de la cartelera (sin acceso a datos: se usa en servidor y en cliente). */

export const CLASIFICACIONES = ["A", "B", "B12", "B15", "C"] as const;
export const IDIOMAS_FILTRO = ["Español", "Inglés"] as const;
export const GENEROS = [
  "Acción",
  "Animación",
  "Aventura",
  "Ciencia ficción",
  "Comedia",
  "Drama",
  "Fantasía",
  "Histórica",
  "Infantil",
  "Super-héroes",
  "Terror",
] as const;

export type IdiomaFiltro = "" | (typeof IDIOMAS_FILTRO)[number];

export type FuncionVM = {
  id: number;
  fecha: string; // YYYY-MM-DD
  hora: string; // HH:MM
  idioma: string;
  subtitulos: boolean;
  formato: string; // "Doblada Español Latino" / "Subtitulada Inglés"
  sala: { id: number; nombre: string; tipo: string };
};

export type PeliculaVM = {
  id: number;
  slug: string;
  titulo: string;
  clasificacion: string;
  genero: string;
  sinopsis: string;
  posterUrl: string | null;
  director: string;
  actor: string;
  estudio: string;
  funciones: FuncionVM[];
};

export type Filtros = {
  query: string;
  fecha: string | null; // YYYY-MM-DD
  desde: string; // HH:MM o ""
  hasta: string; // HH:MM o ""
  idioma: IdiomaFiltro;
  clasificaciones: string[];
};

export const FILTROS_VACIOS: Filtros = {
  query: "",
  fecha: null,
  desde: "",
  hasta: "",
  idioma: "",
  clasificaciones: [],
};

const unValor = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/**
 * Lee los filtros desde la query string. Sin `fecha` se usa hoy, que es la cartelera del día.
 * Un valor desconocido se ignora, para que un link editado a mano no rompa la pantalla.
 */
export function filtrosDesdeParams(
  sp: Record<string, string | string[] | undefined>,
  hoy: string,
): Filtros {
  const idioma = unValor(sp.idioma);
  return {
    query: unValor(sp.q),
    fecha: unValor(sp.fecha) || hoy,
    desde: unValor(sp.desde),
    hasta: unValor(sp.hasta),
    idioma: (IDIOMAS_FILTRO as readonly string[]).includes(idioma) ? (idioma as IdiomaFiltro) : "",
    clasificaciones: unValor(sp.clasif)
      .split(",")
      .filter((r) => (CLASIFICACIONES as readonly string[]).includes(r)),
  };
}

/** Arma la query string de los filtros. Lo vacío se omite y la fecha de hoy no viaja en la URL. */
export function filtrosToParams(f: Filtros, hoy: string): URLSearchParams {
  const q = new URLSearchParams();
  if (f.query.trim()) q.set("q", f.query.trim());
  if (f.fecha && f.fecha !== hoy) q.set("fecha", f.fecha);
  if (f.desde) q.set("desde", f.desde);
  if (f.hasta) q.set("hasta", f.hasta);
  if (f.idioma) q.set("idioma", f.idioma);
  if (f.clasificaciones.length) q.set("clasif", f.clasificaciones.join(","));
  return q;
}

export const HORAS = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, "0")}:00`);

/** Quita acentos y pasa a minúsculas, para comparar títulos sin depender de mayúsculas. */
export const normalizar = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

/** "Español Latino" -> "Español"; "Inglés" -> "Inglés"; otros idiomas se dejan igual. */
export function idiomaGrupo(idioma: string): string {
  const n = normalizar(idioma);
  if (n.startsWith("espa")) return "Español";
  if (n.startsWith("ingl")) return "Inglés";
  return idioma;
}

export function funcionesFiltradas(p: PeliculaVM, f: Filtros): FuncionVM[] {
  return p.funciones.filter((fn) => {
    if (f.fecha && fn.fecha !== f.fecha) return false;
    if (f.desde && fn.hora < f.desde) return false;
    if (f.hasta && fn.hora > f.hasta) return false;
    if (f.idioma && idiomaGrupo(fn.idioma) !== f.idioma) return false;
    return true;
  });
}

export function peliculasVisibles(
  peliculas: PeliculaVM[],
  f: Filtros,
): { pelicula: PeliculaVM; funciones: FuncionVM[] }[] {
  const q = normalizar(f.query.trim());
  // Con fecha, desde/hasta o idioma, la película se muestra aunque no tenga funciones para ese día:
  // la tarjeta avisa cuándo es su próxima función. Solo la búsqueda y la clasificación ocultan.
  const filtraFunciones = Boolean(f.desde || f.hasta || f.idioma);
  return peliculas
    .map((pelicula) => ({ pelicula, funciones: funcionesFiltradas(pelicula, f) }))
    .filter(({ pelicula, funciones }) => {
      if (q && !normalizar(`${pelicula.titulo} ${pelicula.genero}`).includes(q)) return false;
      if (f.clasificaciones.length && !f.clasificaciones.includes(pelicula.clasificacion)) return false;
      if (filtraFunciones && funciones.length === 0) return false;
      return true;
    });
}

export function rangoLabel(desde: string, hasta: string): string {
  if (desde && hasta) return `${desde} - ${hasta}`;
  if (desde) return `Desde las ${desde}`;
  if (hasta) return `Hasta las ${hasta}`;
  return "Cualquier horario";
}

/** Agrupa funciones por sala conservando el orden de aparición. */
export function agruparPorSala(funciones: FuncionVM[]) {
  const mapa = new Map<number, { sala: FuncionVM["sala"]; funciones: FuncionVM[] }>();
  for (const fn of funciones) {
    const g = mapa.get(fn.sala.id) ?? { sala: fn.sala, funciones: [] };
    g.funciones.push(fn);
    mapa.set(fn.sala.id, g);
  }
  return [...mapa.values()];
}
