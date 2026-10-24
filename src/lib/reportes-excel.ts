import "server-only";
import ExcelJS from "exceljs";
import {
  ETIQUETA_AGRUPAR,
  ETIQUETA_TIPO,
  columnasReporte,
  fechaCorta,
  totalesReporte,
  valorCelda,
  type FiltrosReporte,
  type FilaReporte,
} from "@/lib/reportes";

/**
 * SCRUM-142: arma el archivo Excel del reporte. Usa las MISMAS columnas, valores y totales que la
 * tabla de la pantalla (`columnasReporte` / `valorCelda` / `totalesReporte`) y registra arriba los
 * filtros aplicados, así el archivo corresponde a lo consultado.
 */

const FORMATO_ENTERO = "#,##0";
const FORMATO_MONEDA = '"Q"#,##0.00';

export async function construirExcel(
  filtros: FiltrosReporte,
  filas: FilaReporte[],
  nombrePelicula: string | null,
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Órbita Cinema";
  wb.created = new Date();
  const ws = wb.addWorksheet("Reporte");

  const columnas = columnasReporte(filtros);
  const n = columnas.length;

  // Encabezado con los filtros aplicados.
  const periodo =
    filtros.desde || filtros.hasta
      ? `${filtros.desde ? fechaCorta(filtros.desde) : "inicio"} al ${filtros.hasta ? fechaCorta(filtros.hasta) : "sin límite"}`
      : "Todas las fechas";
  const generado = new Intl.DateTimeFormat("es-GT", {
    timeZone: "America/Guatemala",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date());
  const encabezado: [string, string][] = [
    ["Órbita Cinema — Reporte de ventas y reservas", ""],
    ["Período (fecha de la función)", periodo],
    ["Tipo de información", ETIQUETA_TIPO[filtros.tipo]],
    ["Agrupación", ETIQUETA_AGRUPAR[filtros.agrupar]],
    ["Película", nombrePelicula ?? "Todas"],
    ["Generado", generado],
  ];
  encabezado.forEach(([a, b], i) => {
    const fila = ws.addRow([a, b]);
    fila.getCell(1).font = { bold: true, size: i === 0 ? 14 : 11 };
    if (i === 0) ws.mergeCells(fila.number, 1, fila.number, Math.max(2, n));
  });
  ws.addRow([]);

  // Fila de grupos (solo cuando se ven ventas y reservas juntas).
  if (filtros.tipo === "ambas") {
    const grupos = ws.addRow(columnas.map((c) => c.grupo ?? ""));
    let inicio = 0;
    for (let i = 1; i <= n; i++) {
      if (i === n || (columnas[i]?.grupo ?? "") !== (columnas[inicio]?.grupo ?? "")) {
        if (columnas[inicio]?.grupo && i - inicio > 1) ws.mergeCells(grupos.number, inicio + 1, grupos.number, i);
        inicio = i;
      }
    }
    grupos.font = { bold: true };
    grupos.alignment = { horizontal: "center" };
  }

  const cab = ws.addRow(columnas.map((c) => c.titulo));
  cab.font = { bold: true, color: { argb: "FFFFFFFF" } };
  cab.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  cab.eachCell((c) => {
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2937" } };
  });
  const filaCabecera = cab.number;

  const escribir = (fila: FilaReporte, negrita = false) => {
    const r = ws.addRow(columnas.map((c) => valorCelda(fila, c.clave)));
    columnas.forEach((c, i) => {
      const celda = r.getCell(i + 1);
      if (c.tipo === "entero") celda.numFmt = FORMATO_ENTERO;
      if (c.tipo === "moneda") celda.numFmt = FORMATO_MONEDA;
      if (c.tipo !== "texto") celda.alignment = { horizontal: "right" };
      if (negrita) celda.font = { bold: true };
    });
    return r;
  };

  for (const f of filas) escribir(f);
  const total = escribir(totalesReporte(filas), true);
  total.eachCell((c) => {
    c.border = { top: { style: "thin" } };
  });
  // En el total no tienen sentido ni la fecha, ni la sala, ni la función.
  columnas.forEach((c, i) => {
    if (c.tipo === "texto" && c.clave !== "pelicula") total.getCell(i + 1).value = "";
  });

  columnas.forEach((c, i) => {
    ws.getColumn(i + 1).width = c.clave === "pelicula" ? 34 : c.tipo === "texto" ? 18 : 20;
  });
  ws.views = [{ state: "frozen", ySplit: filaCabecera }];

  return Buffer.from(await wb.xlsx.writeBuffer());
}
