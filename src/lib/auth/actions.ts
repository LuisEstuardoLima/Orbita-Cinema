"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache"; // <-- 1. Importamos revalidatePath
import { headers } from "next/headers";

/**
 * Origen actual (protocolo + host) para los redirects de Supabase Auth
 * (emailRedirectTo / resetPasswordForEmail). En local será http://localhost:3000.
 */
async function getOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return host ? `${proto}://${host}` : "http://localhost:3000";
}

// RNF-006 / RNF-015: Control de acceso por rol

export async function registrarCliente(
  formData: FormData,
): Promise<{ ok?: true; error?: string }> {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const nombre = formData.get("nombre") as string;
  const apellido = formData.get("apellido") as string;
  const telefono = formData.get("telefono") as string;

  // Iniciamos el cliente de Supabase para el servidor
  const supabase = await createClient();

  // Ejecutamos la función de registro de Supabase Auth.
  // emailRedirectTo: a dónde lleva el link del correo de confirmación.
  const origin = await getOrigin();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        nombre,
        apellido,
        telefono,
      },
      emailRedirectTo: `${origin}/login?confirmado=1`,
    },
  });

  // Si el correo ya existe, respondemos el MISMO resultado genérico:
  // no se revela si hay una cuenta con ese correo.
  const yaExiste =
    error?.code === "user_already_exists" ||
    /already registered|already been registered/i.test(error?.message ?? "");
  if (error && !yaExiste) {
    return { error: error.message };
  }

  // Con el correo de confirmación activo no hay sesión todavía,
  // así que solo avisamos al frontend para que muestre el mensaje.
  return { ok: true };
}

export async function cerrarSesion() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  
  // 3. Limpiamos la caché global antes de redirigir al login
  revalidatePath('/', 'layout');
  redirect("/login");
}


export async function iniciarSesion(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const supabase = await createClient();

  // Función nativa de Supabase para iniciar sesión
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return { error: "Correo o contraseña incorrectos" };
  }

  // Limpiamos la caché global y redirigimos
  revalidatePath('/', 'layout');
  redirect("/");
}

/**
 * "¿Olvidaste tu contraseña?" desde el login.
 * Envía el correo de restablecimiento. Siempre responde ok aunque el correo
 * no exista, para no revelar si hay una cuenta con esa dirección.
 */
export async function solicitarResetContrasena(
  formData: FormData,
): Promise<{ ok?: true; message?: string; error?: string }> {
  const email = formData.get("email") as string;

  const supabase = await createClient();
  const origin = await getOrigin();

  // Se ignora el resultado: responderemos siempre lo mismo para no revelar
  // si existe o no una cuenta con ese correo.
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/reset-password`,
  });

  return {
    ok: true,
    message:
      "Si existe una cuenta con ese correo, recibirás un enlace para restablecer tu contraseña.",
  };
}

/**
 * Página /reset-password. Recibe el ?code= de la URL (enviado oculto en el form).
 * ORDEN IMPORTANTE: primero se canjea el code por una sesión
 * (sin eso, updateUser falla con "Auth session missing") y recién
 * después se actualiza la contraseña.
 */
export async function actualizarContrasena(
  formData: FormData,
): Promise<{ ok?: true; error?: string }> {
  const password = formData.get("password") as string;
  const confirmar = formData.get("confirmar") as string;
  const code = formData.get("code") as string;

  if (password !== confirmar) {
    return { error: "Las contraseñas no coinciden." };
  }
  if (password.length < 6) {
    return { error: "La contraseña debe tener al menos 6 caracteres." };
  }

  const supabase = await createClient();

  // 1. Canjeamos el código del enlace por una sesión (PKCE flow).
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(
    code,
  );
  if (exchangeError) {
    return {
      error: "El enlace es inválido o expiró. Solicita uno nuevo desde el login.",
    };
  }

  // 2. Con la sesión activa, actualizamos la contraseña.
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    return { error: error.message };
  }

  revalidatePath('/', 'layout');
  redirect("/login?reset=1");
}
