import { createAdminClient } from "@/lib/supabase/admin";

export type UsuarioAdmin = {
  id_usuario: string;
  nombre: string;
  apellido: string;
  email: string;
  rol: string;
  confirmado: boolean;
};

/**
 * Lista todos los usuarios con nombre, apellido, correo electrónico, rol y
 * si han confirmado/activado su cuenta.
 *
 * Ejecuta la RPC `admin_listar_usuarios` con service_role (ignora RLS).
 * Solo debe llamarse desde Server Actions del panel de administración.
 */
export async function listarUsuariosAdmin(): Promise<UsuarioAdmin[]> {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("admin_listar_usuarios");
  if (error) throw new Error(`No se pudo listar usuarios: ${error.message}`);
  // La RPC devuelve exactamente las columnas de UsuarioAdmin
  // (ver supabase/sprint4-usuarios.sql).
  return (data ?? []) as UsuarioAdmin[];
}
