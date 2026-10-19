import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * SCRUM-139: configuración global del sistema.
 *
 * La tabla `configuracion_sistema` tiene una sola fila (id = 1).
 * Se accede únicamente desde el servidor mediante la service role.
 */

const CONFIGURACION_ID = 1;

type ConfiguracionSistemaRow = {
  id: number;
  porcentaje_recargo: number | string;
  updated_at: string;
};

export type ConfiguracionSistema = {
  porcentajeRecargo: number;
  updatedAt: string;
};

/**
 * Obtiene la configuración global del sistema.
 */
export async function getConfiguracionSistema(): Promise<ConfiguracionSistema> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("configuracion_sistema")
    .select("id, porcentaje_recargo, updated_at")
    .eq("id", CONFIGURACION_ID)
    .maybeSingle();

  if (error) {
    throw new Error(
      `No se pudo consultar la configuración del sistema: ${error.message}`,
    );
  }

  const fila = data as ConfiguracionSistemaRow | null;

  if (!fila) {
    throw new Error(
      "No existe la configuración global del sistema.",
    );
  }

  const porcentajeRecargo = Number(fila.porcentaje_recargo);

  if (
    !Number.isFinite(porcentajeRecargo) ||
    porcentajeRecargo < 0 ||
    porcentajeRecargo > 100
  ) {
    throw new Error(
      "El porcentaje de recargo almacenado no es válido.",
    );
  }

  return {
    porcentajeRecargo,
    updatedAt: fila.updated_at,
  };
}

/**
 * Devuelve únicamente el porcentaje usado para calcular nuevas compras.
 *
 * El valor siempre se obtiene de la base de datos y no del navegador.
 */
export async function getPorcentajeRecargo(): Promise<number> {
  const configuracion = await getConfiguracionSistema();

  return configuracion.porcentajeRecargo;
}
