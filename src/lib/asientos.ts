import type { AsientoRow } from "@/lib/db-types";

export const claveColumnaAsiento = (fila: string, columna: number) =>
  `${fila}-${columna}`;

/** Etiquetas visibles de los asientos vendibles, sin contar pasillos ni posiciones deshabilitadas. */
export function crearEtiquetasVisibles(
  distribucion: AsientoRow[],
): Map<string, string> {
  const filas = new Map<string, AsientoRow[]>();

  for (const asiento of distribucion) {
    const lista = filas.get(asiento.fila) ?? [];
    lista.push(asiento);
    filas.set(asiento.fila, lista);
  }

  const etiquetas = new Map<string, string>();
  for (const [fila, asientos] of filas) {
    let numeroVisible = 0;
    for (const asiento of asientos.sort((a, b) => a.numero - b.numero)) {
      if (asiento.estado !== "normal") continue;
      numeroVisible += 1;
      etiquetas.set(
        claveColumnaAsiento(fila, asiento.numero),
        `${fila}${numeroVisible}`,
      );
    }
  }

  return etiquetas;
}
