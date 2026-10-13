import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getRol } from "@/lib/roles";
import { puedeAcceder, reglaDeRuta } from "@/lib/permisos";
import { COOKIE_SESION_TEMPORAL, sinPersistencia } from "@/lib/supabase/sesion";

/**
 * Control de acceso por rol (RNF-006 / RNF-015 / SCRUM-116).
 * Las reglas viven en `src/lib/permisos.ts` (matriz de permisos):
 * - sin sesión -> /login?next=<ruta>
 * - con sesión pero sin permiso para la ruta -> /acceso-denegado
 *
 * Solo actúa si AUTH_GUARD=on, para poder trabajar la UI mientras la autenticación
 * real de Supabase todavía no esté configurada.
 */
export async function middleware(request: NextRequest) {
  if (process.env.AUTH_GUARD !== "on") return NextResponse.next();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.next();

  let response = NextResponse.next({ request });
  // "Recordarme" desactivado: las cookies de sesión que renueve el middleware no deben persistir.
  const temporal = request.cookies.get(COOKIE_SESION_TEMPORAL)?.value === "1";

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, sinPersistencia(options, temporal)),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  if (!reglaDeRuta(path)) return response; // ruta pública

  if (!user) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", path);
    return NextResponse.redirect(login);
  }

  const rol = await getRol(supabase, user.id); // BD: usuarios.id_rol -> rol.nombre (fuente única)
  if (!puedeAcceder(rol, path)) {
    // Sesión válida pero rol sin permiso: pantalla de acceso denegado con mensaje.
    return NextResponse.redirect(new URL("/acceso-denegado", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/perfil/:path*"],
};
