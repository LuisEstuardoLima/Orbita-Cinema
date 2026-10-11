"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache"; // <-- 1. Importamos revalidatePath

// RNF-006 / RNF-015: Control de acceso por rol

export async function registrarCliente(formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;
  const nombre = formData.get("nombre") as string;
  const apellido = formData.get("apellido") as string;
  const telefono = formData.get("telefono") as string;

  // Iniciamos el cliente de Supabase para el servidor
  const supabase = await createClient();

  // Ejecutamos la función de registro de Supabase Auth
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        nombre,
        apellido,
        telefono,
      },
    },
  });

  // Si hay un error (ej. el correo ya existe), lo devolvemos al frontend
  if (error) {
    return { error: error.message };
  }

  // 2. Limpiamos la caché global antes de redirigir
  revalidatePath('/', 'layout');
  
  // Si el registro es exitoso, Supabase inicia la sesión automáticamente.
  // Redirigimos al usuario a la página principal.
  redirect("/");
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
