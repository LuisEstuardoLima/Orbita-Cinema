import "server-only";

import { createClient } from "@/lib/supabase/server";
import { ahoraGuatemala } from "@/lib/fechas";
import {
  formatoFuncion,
  validarCantidades,
  type Cantidades,
  B15,
  C,
  type FuncionCompra,
  type ResumenCompra,
} from "@/lib/compra";
import { getPorcentajeRecargo } from "@/lib/db/configuracion";
import {
  COLUMNA_PRECIO,
  TIPOS_ENTRADA,
  type TipoEntradaId,
} from "@/lib/entradas";
import type {
  FuncionRow,
  PeliculaRow,
  SalaRow,
} from "@/lib/db-types";

/**
 * SCRUM-117 / SCRUM-122 / SCRUM-139:
 * datos de la función que se compra y cálculo del resumen.
 *
 * Es la ÚNICA fuente del dinero del flujo de compra:
 * /asientos muestra lo que devuelve `calcularResumenCompra`,
 * y /pago y el registro de la compra deben volver a llamarla
 * en lugar de confiar en montos que lleguen por la URL o
 * desde el navegador.
 *
 * SCRUM-139:
 * el porcentaje de recargo se obtiene desde la configuración
 * persistente almacenada en la base de datos. El navegador
 * no decide qué porcentaje aplicar.
 */

type Resultado<T> =
  | ({ ok: true } & T)
  | { ok: false; error: string };

export type FuncionConPrecios = Resultado<{
  funcion: FuncionCompra;
  precios: Record<TipoEntradaId, number>;
}>;

/**
 * true si la función ya empezó o pertenece al pasado,
 * utilizando la hora de Guatemala.
 */
const yaEmpezo = (
  fecha: string,
  hora: string,
) => {
  const ahora = ahoraGuatemala();

  return (
    `${fecha} ${hora.slice(0, 5)}` <=
    `${ahora.fecha} ${ahora.hora}`
  );
};

/**
 * Obtiene la función junto con su película, sala y precios.
 *
 * Comprueba que:
 * - la función exista y esté activa;
 * - todavía no haya comenzado;
 * - la película esté disponible;
 * - la sala esté activa;
 * - existan precios válidos.
 */
export async function getFuncionCompra(
  idFuncion: number,
): Promise<FuncionConPrecios> {
  if (
    !Number.isInteger(idFuncion) ||
    idFuncion <= 0
  ) {
    return {
      ok: false,
      error:
        "No se indicó una función válida.",
    };
  }

  const supabase = await createClient();

  const fun = await supabase
    .from("funcion")
    .select("*")
    .eq("id", idFuncion)
    .maybeSingle();

  if (fun.error) {
    return {
      ok: false,
      error: `No se pudo consultar la función: ${fun.error.message}`,
    };
  }

  const f = fun.data as FuncionRow | null;

  if (
    !f ||
    !f.activa ||
    f.id_pelicula == null ||
    f.id_sala == null
  ) {
    return {
      ok: false,
      error:
        "Esta función no existe o fue cancelada.",
    };
  }

  if (yaEmpezo(f.fecha, f.hora)) {
    return {
      ok: false,
      error:
        "Esta función ya empezó o ya pasó.",
    };
  }

  const [pel, sal] = await Promise.all([
    supabase
      .from("pelicula")
      .select(
        "id, titulo, slug, activa, eliminada, clasificacion",
      )
      .eq("id", f.id_pelicula)
      .maybeSingle(),

    supabase
      .from("sala")
      .select("*")
      .eq("id", f.id_sala)
      .maybeSingle(),
  ]);

  if (pel.error) {
    return {
      ok: false,
      error: `No se pudo consultar la película: ${pel.error.message}`,
    };
  }

  if (sal.error) {
    return {
      ok: false,
      error: `No se pudo consultar la sala: ${sal.error.message}`,
    };
  }

  const pelicula = pel.data as Pick<
    PeliculaRow,
    | "titulo"
    | "slug"
    | "activa"
    | "eliminada"
    | "clasificacion"
  > | null;

  const sala = sal.data as SalaRow | null;

  if (
    !pelicula ||
    !pelicula.activa ||
    pelicula.eliminada
  ) {
    return {
      ok: false,
      error:
        "La película de esta función ya no está disponible.",
    };
  }

  if (!sala || !sala.activa) {
    return {
      ok: false,
      error:
        "La sala de esta función ya no está disponible.",
    };
  }

  const precios = {} as Record<
    TipoEntradaId,
    number
  >;

  for (const t of TIPOS_ENTRADA) {
    const valor = Number(
      sala[COLUMNA_PRECIO[t.id]],
    );

    if (
      !Number.isFinite(valor) ||
      valor <= 0
    ) {
      return {
        ok: false,
        error:
          "La sala de esta función todavía no tiene precios configurados.",
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
      clasificacion:
        pelicula.clasificacion,
      fecha: f.fecha,
      hora: f.hora.slice(0, 5),
      sala: sala.nombre,
      tipoSala: sala.tipo_sala ?? "",
      formato: formatoFuncion(
        f.idioma,
        f.subtitulos,
      ),
    },
    precios,
  };
}

/**
 * SCRUM-123:
 * las películas B15 y C no permiten entradas de niños.
 */
export function validarClasificacionNiños(
  cantidades: Cantidades,
  clasificacion: string,
): string | null {
  if ([B15, C].includes(clasificacion)) {
    const cantidadNinos =
      cantidades.ninos;

    if (cantidadNinos > 0) {
      return `Las películas clasificadas como ${clasificacion} no permiten la entrada de Niños.`;
    }
  }

  return null;
}

/**
 * Convierte quetzales a centavos enteros para evitar
 * errores acumulados de punto flotante.
 */
const aCentavos = (q: number) =>
  Math.round(q * 100);

/**
 * SCRUM-122 / SCRUM-139:
 * calcula el resumen completo de una compra.
 *
 * El servidor obtiene:
 * - precios vigentes;
 * - cantidades;
 * - clasificación;
 * - porcentaje de recargo persistente.
 *
 * No utiliza precios, porcentajes ni totales proporcionados
 * por el navegador.
 */
export async function calcularResumenCompra(
  idFuncion: number,
  cantidades: Cantidades,
): Promise<
  Resultado<{ resumen: ResumenCompra }>
> {
  const errorCantidades =
    validarCantidades(cantidades);

  if (errorCantidades) {
    return {
      ok: false,
      error: errorCantidades,
    };
  }

  const datos =
    await getFuncionCompra(idFuncion);

  if (!datos.ok) {
    return datos;
  }

  const lineas = TIPOS_ENTRADA.map(
    (t) => {
      const cantidad =
        cantidades[t.id];

      const unitario = aCentavos(
        datos.precios[t.id],
      );

      return {
        tipo: t.id,
        nombre: t.nombre,
        cantidad,
        precioUnitario:
          unitario / 100,
        importe:
          (unitario * cantidad) /
          100,
      };
    },
  );

  const errorClasificacion =
    validarClasificacionNiños(
      cantidades,
      datos.funcion.clasificacion,
    );

  if (errorClasificacion) {
    return {
      ok: false,
      error: errorClasificacion,
    };
  }

  const subtotal = lineas.reduce(
    (s, l) =>
      s + aCentavos(l.importe),
    0,
  );

  /**
   * SCRUM-139:
   * el porcentaje se consulta en la BD.
   * No procede de parámetros enviados por el cliente.
   */
  const porcentajeRecargo =
    await getPorcentajeRecargo();

  const recargo = Math.round(
    (subtotal * porcentajeRecargo) /
      100,
  );

  return {
    ok: true,
    resumen: {
      funcion: datos.funcion,
      lineas,

      entradas: lineas.reduce(
        (s, l) =>
          s + l.cantidad,
        0,
      ),

      subtotal: subtotal / 100,

      porcentajeRecargo,

      recargo: recargo / 100,

      total:
        (subtotal + recargo) /
        100,
    },
  };
}