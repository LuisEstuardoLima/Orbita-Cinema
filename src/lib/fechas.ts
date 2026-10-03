/** Fecha y hora actuales en Guatemala (UTC-6). Vercel corre en UTC, así que no se puede usar new Date() a secas. */
export function ahoraGuatemala(): { fecha: string; hora: string } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Guatemala",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return { fecha: `${get("year")}-${get("month")}-${get("day")}`, hora: `${get("hour")}:${get("minute")}` };
}

/** "2026-10-05" -> Date local (sin desfase por zona horaria). */
export function parseFecha(fecha: string): Date {
  const [y, m, d] = fecha.split("-").map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
}

/** Date local -> "2026-10-05". */
export function toFecha(date: Date): string {
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${mm}-${dd}`;
}
