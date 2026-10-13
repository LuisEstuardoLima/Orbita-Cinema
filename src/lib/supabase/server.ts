import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { COOKIE_SESION_TEMPORAL, sinPersistencia } from "@/lib/supabase/sesion";

/**
 * Cliente de Supabase para Server Components, Route Handlers (/api) y Server Actions.
 * `sesionTemporal` solo lo pasa el login (sin "Recordarme"); en el resto se lee la marca.
 */
export async function createClient(opciones?: { sesionTemporal?: boolean }) {
  const cookieStore = await cookies();
  const temporal =
    opciones?.sesionTemporal ?? cookieStore.get(COOKIE_SESION_TEMPORAL)?.value === "1";

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, sinPersistencia(options, temporal)),
            );
          } catch {
            // Llamado desde un Server Component: el middleware se encarga de refrescar la sesión.
          }
        },
      },
    },
  );
}
