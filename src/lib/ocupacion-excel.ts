import "server-only";
import ExcelJS from "exceljs";
import {
  ETIQUETA_ESTADO,
  ETIQUETA_ORIGEN,
  ETIQUETA_TIPO_ASIENTO,
  etiquetaAsiento,
  type ReporteOcupacion,
} from "@/lib/ocupacion";
import { fechaCorta } from "@/lib/reportes";

/**
 * SCRUM-143: arma el Excel de ocupación de UNA función. Usa los mismos datos que la pantalla
 * (`ReporteOcupacion`): hoja «Resumen» con la función y los indicadores, y hoja «Asientos» con el
 * detalle de cada asiento (fila, número y estado).
 */

const AZUL = "FF1F2937";

export async function construirExcelOcupacion(r: ReporteOcupacion): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Órbita Cinema";
  wb.created = new Date();

  // ---- Hoja 1: Resumen ----
  const ws = wb.addWorksheet("Resumen");
  ws.columns = [{ width: 34 }, { width: 38 }];
  const generado = new Intl.DateTimeFormat("es-GT", {
    timeZone: "America/Guatemala",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date());

  const titulo = ws.addRow(["Órbita Cinema — Reporte de ocupación por sala"]);
  titulo.font = { bold: true, size: 14 };
  ws.mergeCells(titulo.number, 1, titulo.number, 2);
  ws.addRow([]);

  const bloque = (nombre: string, filas: [string, string | number, string?][]) => {
    const cab = ws.addRow([nombre]);
    cab.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cab.eachCell((c) => {
      c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } };
    });
    ws.mergeCells(cab.number, 1, cab.number, 2);
    for (const [k, v, fmt] of filas) {
      const f = ws.addRow([k, v]);
      f.getCell(1).font = { bold: true };
      f.getCell(2).alignment = { horizontal: "left" };
      if (fmt) f.getCell(2).numFmt = fmt;
    }
    ws.addRow([]);
  };

  bloque("Función", [
    ["Película", r.funcion.pelicula],
    ["Fecha", fechaCorta(r.funcion.fecha)],
    ["Hora", r.funcion.hora],
    ["Sala", r.funcion.sala],
    ["Estado de la función", r.funcion.activa ? "Activa" : "Cancelada"],
    ["ID de función", r.funcion.id],
    ["Generado", generado],
  ]);
  bloque("Ocupación", [
    ["Capacidad total", r.resumen.capacidad, "#,##0"],
    ["Asientos ocupados o reservados", r.resumen.ocupados, "#,##0"],
    ["   · Reservados (pagados)", r.resumen.reservados, "#,##0"],
    ["   · En compra (bloqueo temporal)", r.resumen.enCompra, "#,##0"],
    ["Asientos disponibles", r.resumen.disponibles, "#,##0"],
    // El porcentaje se guarda como fracción con formato de porcentaje: 41.67 % -> 0.4167.
    ["Porcentaje de ocupación", Math.round(r.resumen.porcentaje * 100) / 10000, "0.00%"],
  ]);

  // ---- Hoja 2: Asientos ----
  const wa = wb.addWorksheet("Asientos");
  const cab = wa.addRow(["Fila", "Asiento", "Columna física", "Tipo", "Estado", "Detalle"]);
  cab.font = { bold: true, color: { argb: "FFFFFFFF" } };
  cab.alignment = { horizontal: "center" };
  cab.eachCell((c) => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: AZUL } };
  });
  for (const a of r.asientos) {
    const f = wa.addRow([
      a.fila,
      a.tipo === "normal" || a.estado === "ocupado" ? etiquetaAsiento(a) : "",
      a.columna,
      ETIQUETA_TIPO_ASIENTO[a.tipo],
      ETIQUETA_ESTADO[a.estado],
      a.origen ? ETIQUETA_ORIGEN[a.origen] : "",
    ]);
    f.getCell(5).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: {
        argb:
          a.estado === "ocupado"
            ? "FFFECACA"
            : a.estado === "libre"
              ? "FFBBF7D0"
              : "FFE5E7EB",
      },
    };
    f.getCell(3).alignment = { horizontal: "center" };
  }
  wa.columns = [
    { width: 8 },
    { width: 12 },
    { width: 16 },
    { width: 22 },
    { width: 18 },
    { width: 32 },
  ];
  wa.views = [{ state: "frozen", ySplit: 1 }];
  wa.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 6 } };

  return Buffer.from(await wb.xlsx.writeBuffer());
}
