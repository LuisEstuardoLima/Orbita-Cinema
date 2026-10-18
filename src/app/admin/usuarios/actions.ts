"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { assertAdmin } from "@/lib/auth/guard";

type ActionResult = { ok: true } | { ok: false; error: string };

async function getOrigin(): Promise<string> {
  const { headers } = await import("next/headers");
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "http";
  return host ? `${proto}://${host}` : "http://localhost:3000";
}

const schemaCrear = z.object({
  nombre: z.string({ required_error: "El nombre es obligatorio." }).trim().min(1, "El nombre es obligatorio.").max(100, "El nombre es demasiado largo."),
  apellido: z.string({ required_error: "El apellido es obligatorio." }).trim().min(1, "El apellido es obligatorio.").max(100, "El apellido es demasiado largo."),
  email: z.string({ required_error: "El correo electrónico es obligatorio." }).trim().email("Introduce un correo electrónico válido."),
  telefono: z.string({ required_error: "El teléfono es obligatorio." }).trim().min(1, "El teléfono es obligatorio.").max(30, "El teléfono es demasiado largo."),
  rol: z.enum(["Colaborador", "Administrador"], { errorMap: () => ({ message: "Selecciona un rol válido." }) }),
});

const schemaRol = z.object({
  idUsuario: z.string({ required_error: "Usuario requerido." }).uuid("UUID inválido."),
  nuevoRol: z.enum(["Cliente", "Colaborador", "Administrador"], { errorMap: () => ({ message: "Rol inválido." }) }),
});

/**
 * Crea una cuenta de personal (Colaborador o Administrador) desde el panel de
 * administración. No pide contraseña: envía una invitación por correo para que
 * el usuario establezca su propia contraseña.
 *
 * Seguridad: toda la ejecución es en servidor con service_role; el navegador
 * nunca ve credenciales ni la llave de service_role.
 */
export async function crearCuentaPersonal(
  formData: FormData,
): Promise<ActionResult> {
  const denied = await assertAdmin();
  if (denied) return { ok: false, error: denied };

  const parsed = schemaCrear.safeParse({
    nombre: formData.get("nombre"),
    apellido: formData.get("apellido"),
    email: formData.get("email"),
    telefono: formData.get("telefono"),
    rol: formData.get("rol"),
  });
  if (!parsed.success)
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
    };
  const d = parsed.data;

  const admin = createAdminClient();

  // Verificar si el correo ya existe en Supabase Auth.
  // La respuesta es { data: { users: [...] }, error }.
  const { data: listData, error: errList } = await admin.auth.admin.listUsers({
    perPage: 1000,
    page: 1,
  });
  if (errList)
    return { ok: false, error: "No se pudo verificar si el correo ya existe." };

  const usuarios = listData?.users ?? [];
  const existente = usuarios.find(
    (u) => u.email?.toLowerCase() === d.email.toLowerCase(),
  );

  if (existente) {
    // Ya existe una cuenta confirmada: no se permite duplicar.
    if (existente.email_confirmed_at) {
      return {
        ok: false,
        error: "Ya existe una cuenta con ese correo electrónico.",
      };
    }
    // Invitación pendiente de activación: se elimina y se re-invita (sin duplicados).
    const { error: errDel } = await admin.auth.admin.deleteUser(existente.id);
    if (errDel)
      return {
        ok: false,
        error: "No se pudo reemplazar la invitación pendiente.",
      };
  }

  const origin = await getOrigin();

  // Crear la cuenta de invitación. Supabase (SMTP/Brevo) envía el correo con el
  // enlace de activación. No se pasa contraseña ni se confirma el email aquí.
  const { data: invitado, error: errInvite } =
    await admin.auth.admin.inviteUserByEmail(d.email, {
      data: {
        nombre: d.nombre,
        apellido: d.apellido,
        telefono: d.telefono,
      },
      redirectTo: `${origin}/aceptar-invitacion`,
    });

  if (errInvite)
    return {
      ok: false,
      error: `No se pudo enviar la invitación: ${errInvite.message}`,
    };

  if (!invitado?.user?.id) {
    return { ok: false, error: "No se pudo crear la cuenta de invitación." };
  }

  // Asignar el rol seleccionado en public.usuarios (solo service_role puede
  // escribir id_rol; los grants impiden que un usuario autenticado lo haga).
  const idRol = d.rol === "Administrador" ? 3 : 2;
  const { error: errRol } = await admin
    .from("usuarios")
    .update({ id_rol: idRol })
    .eq("id_usuario", invitado.user.id);

  if (errRol) {
    // Compensación: borrar la cuenta recién creada para no dejar huérfana.
    await admin.auth.admin.deleteUser(invitado.user.id).catch(() => {});
    return {
      ok: false,
      error: "No se pudo asignar el rol. La cuenta se eliminó para evitar duplicados.",
    };
  }

  revalidatePath("/admin/usuarios");
  return { ok: true };
}


/**
 * Cambia el rol de un usuario existente. Solo Administrador.
 * Protección: no permite quitarse el propio rol de Administrador.
 */
export async function cambiarRol(formData: FormData): Promise<ActionResult> {
  const denied = await assertAdmin();
  if (denied) return { ok: false, error: denied };

  const parsed = schemaRol.safeParse({
    idUsuario: formData.get("idUsuario"),
    nuevoRol: formData.get("nuevoRol"),
  });
  if (!parsed.success)
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Datos inválidos.",
    };
  const { idUsuario, nuevoRol } = parsed.data;

  // Obtener el usuario autenticado actual (para la protección de la propia cuenta).
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Debes iniciar sesión." };

  // Protección: no quitarse el propio rol de Administrador.
  if (idUsuario === user.id && nuevoRol !== "Administrador") {
    return {
      ok: false,
      error: "No puedes quitar tu propio rol de Administrador.",
    };
  }

  const admin = createAdminClient();
  const idRol =
    nuevoRol === "Administrador"
      ? 3
      : nuevoRol === "Colaborador"
        ? 2
        : 1;

  const { data, error } = await admin
    .from("usuarios")
    .update({ id_rol: idRol })
    .eq("id_usuario", idUsuario)
    .select("id_usuario");

  if (error)
    return { ok: false, error: `No se pudo cambiar el rol: ${error.message}` };

  if (!data || data.length === 0) {
    return {
      ok: false,
      error: "No se pudo cambiar el rol: el usuario no existe o no se pudo localizar.",
    };
  }

  revalidatePath("/admin/usuarios");
  return { ok: true };
}

