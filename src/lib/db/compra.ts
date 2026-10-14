import "server-only";
import { createClient } from "@/lib/supabase/server";
import { ahoraGuatemala } from "@/lib/fechas";
import {
  formatoFuncion,
  PORCENTAJE_RECARGO,
  validarCantidades,
  type Cantidades,
  B15,
  C,
  type FuncionCompra,
  type ResumenCompra,
} from "@/lib/compra";
import { COLUMNA_PRECIO, TIPOS_ENTRADA, type TipoEntradaId } from "@/lib/entradas";
import type { FuncionRow, PeliculaRow, SalaRow } from "@/lib/db-types";

/**
 * SCRUM-117 / SCRUM-122: datos de la función que se compra y cálculo del resumen.
 *
 * Es la ÚNICA fuente del dinero del flujo de compra: /asientos muestra lo que devuelve
 * `calcularResumenCompra`, y /pago (SCRUM-124) y el registro de la compra (SCRUM-125) deben
 * volver a llamarla en lugar de confiar en montos que lleguen por la URL o del navegador.
 *
 * Lee con el cliente de servidor (respeta RLS), igual que la cartelera: las políticas de
 * sprint1.sql ya dejan leer películas, salas y funciones activas, con sus precios.
 */

type Resultado<T> = ({ ok: true } & T) | { ok: false; error: string };

export type FuncionConPrecios = Resultado<{
  funcion: FuncionCompra;
  precios: Record<TipoEntradaId, number>;
}>;

/** true si la función (fecha + hora) ya empezó o es del pasado, en hora de Guatemala. */
const yaEmpezo = (fecha: string, hora: string) => {
  const ahora = ahoraGuatemala();
  return `${fecha} ${hora.slice(0, 5)}` <= `${ahora.fecha} ${ahora.hora}`;
};

/**
 * La función con su película, su sala y los precios de esa sala, si se puede vender:
 * existe, está activa, no ha empezado, su película y su sala están activas y la sala tiene
 * los tres precios. Si no, devuelve el mensaje para mostrar al cliente.
 */
export async function getFuncionCompra(idFuncion: number): Promise<FuncionConPrecios> {
  if (!Number.isInteger(idFuncion) || idFuncion <= 0) {
    return { ok: false, error: "No se indicó una función válida." };
  }

  const supabase = await createClient();

  // Con RLS, una función cancelada (activa = false) no se puede leer: cae en "no existe".
  const fun = await supabase.from("funcion").select("*").eq("id", idFuncion).maybeSingle();
  if (fun.error)
    return { ok: false, error: `No se pudo consultar la función: ${fun.error.message}` };
  const f = fun.data as FuncionRow | null;
  if (!f || !f.activa || f.id_pelicula == null || f.id_sala == null) {
    return { ok: false, error: "Esta función no existe o fue cancelada." };
  }
  if (yaEmpezo(f.fecha, f.hora)) {
    return { ok: false, error: "Esta función ya empezó o ya pasó." };
  }

  // `select("*")` en sala: si las columnas de precio aún no existen, no falla la consulta;
  // simplemente faltan y se avisa abajo como "sin precios".
  const [pel, sal] = await Promise.all([
    supabase
      .from("pelicula")
      .select("id, titulo, slug, activa, eliminada, clasificacion")
      .eq("id", f.id_pelicula)
      .maybeSingle(),
    supabase.from("sala").select("*").eq("id", f.id_sala).maybeSingle(),
  ]);
  if (pel.error)
    return { ok: false, error: `No se pudo consultar la película: ${pel.error.message}` };
  if (sal.error) return { ok: false, error: `No se pudo consultar la sala: ${sal.error.message}` };

  const pelicula = pel.data as Pick<PeliculaRow, "titulo" | "slug" | "activa" | "eliminada" | "clasificacion"> | null;
  const sala = sal.data as SalaRow | null;
  if (!pelicula || !pelicula.activa || pelicula.eliminada) {
    return { ok: false, error: "La película de esta función ya no está disponible." };
  }
  if (!sala || !sala.activa) {
    return { ok: false, error: "La sala de esta función ya no está disponible." };
  }

  const precios = {} as Record<TipoEntradaId, number>;
  for (const t of TIPOS_ENTRADA) {
    const valor = Number(sala[COLUMNA_PRECIO[t.id]]);
    if (!Number.isFinite(valor) || valor <= 0) {
      return {
        ok: false,
        error: "La sala de esta función todavía no tiene precios configurados.",
      };
    }
    precios[t.id] = valor;
  }

  return {
    ok: true,
    funcion: {
      id: f.id,
      pelicula: pelicula.titulo,
      slug: pelicula.slug,
      clasificacion: pelicula.clasificacion,
      fecha: f.fecha,
      hora: f.hora.slice(0, 5),
      sala: sala.nombre,
      tipoSala: sala.tipo_sala ?? "",
      formato: formatoFuncion(f.idioma, f.subtitulos),
    },
    precios,
  };
}

/**
 * Validación para bloquear niños en películas clasificadas como B15 o C.
 * SCRUM-123: las películas con estas clasificaciones no permiten entrada de niños.
 */
export function validarClasificacionNiños(cantidades: Cantidades, clasificacion: string): string | null {
  if ([B15, C].includes(clasificacion)) {
    const cantidadNinos = cantidades.ninos;
    if (cantidadNinos > 0) {
      return `Las películas clasificadas como ${clasificacion} no permiten la entrada de Niños.`;
    }
  }
  return null;
}

/** quetzales -> centavos enteros (los montos se suman en centavos para no arrastrar decimales). */
const aCentavos = (q: number) => Math.round(q * 100);

/**
 * SCRUM-122: resumen de la compra de una función con las cantidades elegidas.
 * Valida en el servidor la función (`getFuncionCompra`) y las cantidades (enteros de 0 a 10
 * por tipo, total de 1 a 10). recargo = 5 % del subtotal redondeado a 2 decimales;
 * total = subtotal + recargo.
 *
 * Reutilizar en SCRUM-124 (pago) y SCRUM-125 (registro de la compra).
 */
export async function calcularResumenCompra(
  idFuncion: number,
  cantidades: Cantidades,
): Promise<Resultado<{ resumen: ResumenCompra }>> {
  const errorCantidades = validarCantidades(cantidades);
  if (errorCantidades) return { ok: false, error: errorCantidades };

  const datos = await getFuncionCompra(idFuncion);
  if (!datos.ok) return datos;

  const lineas = TIPOS_ENTRADA.map((t) => {
    const cantidad = cantidades[t.id];
    const unitario = aCentavos(datos.precios[t.id]);
    return {
      tipo: t.id,
      nombre: t.nombre,
      cantidad,
      precioUnitario: unitario / 100,
      importe: (unitario * cantidad) / 100,
    };
  });

  const errorClasificacion = validarClasificacionNiños(cantidades, datos.funcion.clasificacion);
  if (errorClasificacion) return { ok: false, error: errorClasificacion };

  const subtotal = lineas.reduce((s, l) => s + aCentavos(l.importe), 0);
  const recargo = Math.round((subtotal * PORCENTAJE_RECARGO) / 100);

  return {
    ok: true,
    resumen: {
      funcion: datos.funcion,
      lineas,
      entradas: lineas.reduce((s, l) => s + l.cantidad, 0),
      subtotal: subtotal / 100,
      recargo: recargo / 100,
      total: (subtotal + recargo) / 100,
    },
  };
}
