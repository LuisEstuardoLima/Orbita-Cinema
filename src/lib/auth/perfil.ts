import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getRol, type Rol } from "@/lib/roles";

export type PerfilActual = {
  nombre: string;
  apellido: string;
  telefono: string;
  email: string;
  rol: Rol;
};

/**
 * Datos de la cuenta de quien tiene la sesión iniciada (nombre, correo y
 * teléfono, para el flujo de compra), o null si no hay sesión.
 * `cache` evita repetir las consultas cuando el layout y la página lo piden en la misma request.
 */
export const getPerfilActual = cache(async (): Promise<PerfilActual | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: perfil }, rol] = await Promise.all([
    supabase.from("usuarios").select("nombre, apellido, telefono").eq("id_usuario", user.id).maybeSingle(),
    getRol(supabase, user.id),
  ]);

  return {
    nombre: perfil?.nombre ?? "",
    apellido: perfil?.apellido ?? "",
    telefono: perfil?.telefono ?? "",
    email: user.email ?? "",
    rol,
  };
});
