import type { SupabaseClient } from "@supabase/supabase-js";

/** Roles definidos en la documentación (RF-040): Cliente, Colaborador y Administrador. */
export type Rol = "Cliente" | "Colaborador" | "Administrador";

const ROLES: readonly string[] = ["Cliente", "Colaborador", "Administrador"];

function esRol(valor: unknown): valor is Rol {
  return typeof valor === "string" && ROLES.includes(valor);
}

/**
 * Lee el rol del usuario desde la BD (fuente única: `usuarios.id_rol` -> `rol.nombre`).
 * Cualquier fila inesperada (sin usuario o con nombre de rol desconocido) se
 * considera "Cliente", el rol más restrictivo.
 *
 * Se consulta por request en lugar de confiar en un claim del JWT porque:
 * - `user_metadata` lo edita el propio navegador: nunca decide permisos.
 * - `app_metadata` obligaría a escribir en dos lugares al promover a alguien.
 * El middleware solo lo llama para /admin/* y /perfil, y el filtro es por PK.
 */
export async function getRol(
  supabase: SupabaseClient,
  idUsuario: string,
): Promise<Rol> {
  const { data } = await supabase
    .from("usuarios")
    .select("rol(nombre)") // FK id_rol -> rol.id_rol: una sola consulta
    .eq("id_usuario", idUsuario)
    .maybeSingle();

  // PostgREST devuelve el embed como objeto (many-to-one) por la FK, pero sin
  // tipos generados supabase-js lo tipea como arreglo; se aceptan ambos casos.
  const embed = data?.rol as unknown as
    | { nombre?: unknown }
    | { nombre?: unknown }[]
    | null;
  const nombre = (Array.isArray(embed) ? embed[0] : embed)?.nombre;
  return esRol(nombre) ? nombre : "Cliente";
}

