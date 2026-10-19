"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { assertAdmin } from "@/lib/auth/guard";
import { createAdminClient } from "@/lib/supabase/admin";

type ActionResult =
  | {
      ok: true;
      porcentajeRecargo: number;
    }
  | {
      ok: false;
      error: string;
    };

/**
 * SCRUM-139:
 * validación del porcentaje en servidor.
 *
 * - obligatorio;
 * - numérico;
 * - no negativo;
 * - máximo 100 %;
 * - máximo 2 decimales.
 */
const schema = z.object({
  porcentajeRecargo: z.preprocess(
    (valor) => {
      if (
        typeof valor === "string" &&
        valor.trim() === ""
      ) {
        return undefined;
      }

      if (typeof valor === "string") {
        return Number(valor);
      }

      return valor;
    },
    z
      .number({
        required_error:
          "El porcentaje de recargo es obligatorio.",
        invalid_type_error:
          "El porcentaje de recargo debe ser un número válido.",
      })
      .finite(
        "El porcentaje de recargo debe ser un número válido.",
      )
      .min(
        0,
        "El porcentaje de recargo no puede ser negativo.",
      )
      .max(
        100,
        "El porcentaje de recargo no puede ser mayor que 100 %.",
      )
      .refine(
        (valor) =>
          Math.abs(
            valor * 100 -
              Math.round(valor * 100),
          ) < 1e-9,
        {
          message:
            "El porcentaje puede tener como máximo 2 decimales.",
        },
      ),
  ),
});

/**
 * Actualiza la configuración global del porcentaje de recargo.
 *
 * Seguridad:
 * - únicamente Administrador;
 * - el valor se valida nuevamente en servidor;
 * - se actualiza mediante service_role;
 * - el navegador no puede escribir directamente en la tabla.
 */
export async function guardarPorcentajeRecargo(
  formData: FormData,
): Promise<ActionResult> {
  const denied = await assertAdmin();

  if (denied) {
    return {
      ok: false,
      error: denied,
    };
  }

  const parsed = schema.safeParse({
    porcentajeRecargo:
      formData.get("porcentajeRecargo"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      error:
        parsed.error.issues[0]
          ?.message ??
        "El porcentaje ingresado no es válido.",
    };
  }

  const porcentajeRecargo =
    parsed.data.porcentajeRecargo;

  const admin = createAdminClient();

  const { data, error } = await admin
    .from("configuracion_sistema")
    .update({
      porcentaje_recargo:
        porcentajeRecargo,
      updated_at:
        new Date().toISOString(),
    })
    .eq("id", 1)
    .select("id, porcentaje_recargo")
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      error: `No se pudo guardar la configuración: ${error.message}`,
    };
  }

  if (!data) {
    return {
      ok: false,
      error:
        "No se encontró la configuración del sistema.",
    };
  }

  const porcentajeGuardado = Number(
    data.porcentaje_recargo,
  );

  if (
    !Number.isFinite(
      porcentajeGuardado,
    )
  ) {
    return {
      ok: false,
      error:
        "La configuración se guardó con un valor inválido.",
    };
  }

  revalidatePath(
    "/admin/configuracion",
  );

  /*
   * Las nuevas compras consultan directamente
   * la configuración persistida, por lo que
   * utilizarán el nuevo porcentaje.
   */
  revalidatePath("/asientos");

  return {
    ok: true,
    porcentajeRecargo:
      porcentajeGuardado,
  };
}