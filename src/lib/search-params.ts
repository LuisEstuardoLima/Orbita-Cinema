/** Utilidades para leer/armar query strings del flujo de compra (reemplaza validateSearch de TanStack Router). */
export type SP = Record<string, string | string[] | undefined>;

export const str = (v: SP[string], d = ""): string => (typeof v === "string" ? v : d);

export const num = (v: SP[string]): number => (typeof v === "string" ? Number(v) : 0) || 0;

export function toHref(path: string, params: Record<string, string | number>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) q.set(k, String(v));
  return `${path}?${q.toString()}`;
}
