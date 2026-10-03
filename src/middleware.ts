import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getRol, type Rol } from "@/lib/roles";

/**
 * Control de acceso por rol (RNF-006 / RNF-015).
 * - /perfil  -> requiere sesión.
 * - /admin/* -> Colaborador o Administrador (/admin/peliculas: solo Administrador).
 *
 * Solo actúa si AUTH_GUARD=on, para poder trabajar la UI mientras la autenticación
 * real de Supabase todavía no esté configurada.
 */
const RULES: { prefix: string; roles: Rol[] | "any" }[] = [
  { prefix: "/admin/peliculas", roles: ["Administrador"] },
  { prefix: "/admin", roles: ["Colaborador", "Administrador"] },
  { prefix: "/perfil", roles: "any" },
];

export async function middleware(request: NextRequest) {
  if (process.env.AUTH_GUARD !== "on") return NextResponse.next();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.next();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const rule = RULES.find((r) => path === r.prefix || path.startsWith(`${r.prefix}/`));
  if (!rule) return response;

  if (!user) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", path);
    return NextResponse.redirect(login);
  }

  const rol = getRol(user);
  if (rule.roles !== "any" && (!rol || !rule.roles.includes(rol))) {
    // No revelamos que el panel existe: se redirige a la cartelera.
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/perfil/:path*"],
};
