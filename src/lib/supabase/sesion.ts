/**
 * "Recordarme" (SCRUM-115).
 *
 * Supabase guarda la sesión en cookies con duración (400 días). Para que, SIN "Recordarme", la
 * sesión termine al cerrar el navegador, el login deja una cookie marcadora de sesión (sin
 * duración) y los tres clientes de Supabase (servidor, middleware y navegador) quitan la
 * duración (`maxAge`/`expires`) de las cookies de sesión mientras esa marca exista. Así también
 * cuando Supabase renueva el token no vuelve a ser persistente.
 *
 * Con "Recordarme" no hay marca y todo queda como Supabase lo deja (sesión persistente).
 */
export const COOKIE_SESION_TEMPORAL = "orbita_sesion_temporal";

type OpcionesCookie = { maxAge?: number; expires?: Date };

/** Quita la duración de la cookie si la sesión es temporal. maxAge 0 (borrar) se respeta. */
export function sinPersistencia<T extends OpcionesCookie>(options: T, temporal: boolean): T {
  if (!temporal || options.maxAge === 0) return options;
  const { maxAge: _maxAge, expires: _expires, ...resto } = options;
  return resto as T;
}

/**
 * Destino seguro para `?next=`: solo rutas internas ("/algo"). Rechaza "//host", "/\host" y
 * cualquier URL absoluta para que el login no sirva de redirección abierta.
 */
export function rutaInterna(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  if (!valor.startsWith("/") || valor.startsWith("//") || valor.includes("\\")) return null;
  return valor;
}
