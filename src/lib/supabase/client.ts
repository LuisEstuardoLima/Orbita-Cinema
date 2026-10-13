import { createBrowserClient, type CookieOptions } from "@supabase/ssr";
import { COOKIE_SESION_TEMPORAL, sinPersistencia } from "@/lib/supabase/sesion";

function leerCookies(): { name: string; value: string }[] {
  if (typeof document === "undefined") return [];
  return document.cookie
    .split(";")
    .map((c) => c.trim())
    .filter(Boolean)
    .map((c) => {
      const i = c.indexOf("=");
      const raw = i === -1 ? "" : c.slice(i + 1);
      let value = raw;
      try {
        value = decodeURIComponent(raw);
      } catch {
        // valor sin codificar: se deja tal cual
      }
      return { name: i === -1 ? c : c.slice(0, i), value };
    });
}

function escribirCookie(name: string, value: string, options: CookieOptions) {
  let s = `${name}=${encodeURIComponent(value)}`;
  if (options.path) s += `; Path=${options.path}`;
  if (options.domain) s += `; Domain=${options.domain}`;
  if (options.maxAge !== undefined) s += `; Max-Age=${Math.floor(options.maxAge)}`;
  if (options.expires) s += `; Expires=${new Date(options.expires).toUTCString()}`;
  if (options.sameSite) {
    s += `; SameSite=${typeof options.sameSite === "string" ? options.sameSite : "Strict"}`;
  }
  if (options.secure) s += "; Secure";
  document.cookie = s;
}

/**
 * Cliente de Supabase para componentes cliente ("use client").
 * Maneja las cookies a mano (en vez de document.cookie por defecto) solo para respetar la marca
 * de sesión temporal de "Recordarme": se consulta en cada escritura porque este cliente es un
 * singleton que se crea antes de iniciar sesión.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return leerCookies();
        },
        setAll(cookiesToSet) {
          if (typeof document === "undefined") return;
          const temporal = leerCookies().some(
            (c) => c.name === COOKIE_SESION_TEMPORAL && c.value === "1",
          );
          cookiesToSet.forEach(({ name, value, options }) =>
            escribirCookie(name, value, sinPersistencia(options, temporal)),
          );
        },
      },
    },
  );
}
