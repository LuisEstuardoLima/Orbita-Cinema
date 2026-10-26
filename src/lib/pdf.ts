import "server-only";
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import QRCode from "qrcode";
import { numeroReserva, quetzales } from "@/lib/compra";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 48;

const COLORS = {
  background: rgb(0.12, 0.12, 0.13),
  surface: rgb(0.16, 0.16, 0.17),
  soft: rgb(0.2, 0.2, 0.21),
  ink: rgb(0.94, 0.94, 0.95),
  muted: rgb(0.68, 0.68, 0.7),
  line: rgb(0.3, 0.3, 0.32),
  accent: rgb(1, 0.635, 0.122),
  accentSoft: rgb(0.28, 0.22, 0.15),
  accentInk: rgb(0.98, 0.95, 0.9),
};

export interface DatosBoleto {
  idReserva: number;
  codigoQr: string;
  pelicula: string;
  clasificacion: string;
  fecha: string;
  hora: string;
  sala: string;
  comprador: string;
  totalPagado: number;
  asientos: Array<{
    fila: string;
    numero: number;
    tipoEntrada: string;
  }>;
}

function dibujarTexto(
  page: PDFPage,
  text: string,
  x: number,
  top: number,
  size: number,
  font: PDFFont,
  color = COLORS.ink,
  options: { maxWidth?: number; lineHeight?: number } = {},
) {
  page.drawText(text, {
    x,
    y: PAGE_HEIGHT - top - size,
    size,
    font,
    color,
    ...options,
  });
}

function dibujarTextoAjustado(
  page: PDFPage,
  text: string,
  x: number,
  top: number,
  maxWidth: number,
  size: number,
  minSize: number,
  font: PDFFont,
  color = COLORS.ink,
) {
  const limpio = text.replace(/\s+/g, " ").trim() || "—";
  let textoFinal = limpio;
  let fontSize = size;

  while (fontSize > minSize && font.widthOfTextAtSize(textoFinal, fontSize) > maxWidth) {
    fontSize -= 0.5;
  }

  while (textoFinal.length > 1 && font.widthOfTextAtSize(textoFinal, fontSize) > maxWidth) {
    textoFinal = `${textoFinal.slice(0, -2).trimEnd()}…`;
  }

  page.drawText(textoFinal, {
    x,
    y: PAGE_HEIGHT - top - fontSize,
    size: fontSize,
    font,
    color,
  });
}

function dibujarLinea(page: PDFPage, top: number, x1: number, x2: number, color = COLORS.line) {
  page.drawLine({
    start: { x: x1, y: PAGE_HEIGHT - top },
    end: { x: x2, y: PAGE_HEIGHT - top },
    thickness: 0.8,
    color,
  });
}

function dibujarLogo(page: PDFPage, bold: PDFFont, top = 38) {
  const x = MARGIN;
  const iconSize = 38;
  const centerY = PAGE_HEIGHT - top - iconSize / 2;

  page.drawCircle({
    x: x + iconSize / 2,
    y: centerY,
    size: iconSize / 2,
    color: COLORS.accent,
  });
  page.drawRectangle({
    x: x + 9,
    y: centerY - 9,
    width: 20,
    height: 18,
    color: COLORS.surface,
    borderColor: COLORS.accentInk,
    borderWidth: 1,
  });
  for (const filmX of [x + 15, x + 23]) {
    page.drawLine({
      start: { x: filmX, y: centerY - 9 },
      end: { x: filmX, y: centerY + 9 },
      thickness: 0.8,
      color: COLORS.accentInk,
    });
  }
  for (const side of [x + 9, x + 25]) {
    for (const filmY of [centerY - 6, centerY, centerY + 6]) {
      page.drawLine({
        start: { x: side, y: filmY },
        end: { x: side + 4, y: filmY },
        thickness: 0.7,
        color: COLORS.accentInk,
      });
    }
  }

  const wordmarkX = x + 50;
  const wordmarkSize = 16;
  const wordmarkY = PAGE_HEIGHT - top - 25;
  const orbitalText = "ÓRBITA";
  page.drawText(orbitalText, {
    x: wordmarkX,
    y: wordmarkY,
    size: wordmarkSize,
    font: bold,
    color: COLORS.ink,
  });
  page.drawText("CINEMA", {
    x: wordmarkX + bold.widthOfTextAtSize(orbitalText, wordmarkSize) + 6,
    y: wordmarkY,
    size: wordmarkSize,
    font: bold,
    color: COLORS.accent,
  });
}

function fechaLegible(fecha: string): string {
  const [anio, mes, dia] = fecha.split("-");
  if (!anio || !mes || !dia) return fecha;
  return `${dia}/${mes}/${anio}`;
}

function etiquetaTipoEntrada(tipo: string): string {
  switch (tipo) {
    case "adulto":
      return "Adulto";
    case "tercera_edad":
      return "3ra. Edad";
    case "nino":
      return "Niños";
    default:
      return tipo;
  }
}

export async function crearPdf(datos: DatosBoleto): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Boleto Órbita Cinema — ${numeroReserva(datos.idReserva)}`);
  pdf.setSubject(`Boleto de entrada para ${datos.pelicula}`);
  pdf.setProducer("Órbita Cinema");
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const qrBytes = await QRCode.toBuffer(datos.codigoQr, {
    type: "png",
    margin: 1,
    width: 240,
  });
  const qrImage = await pdf.embedPng(qrBytes);
  const codigo = numeroReserva(datos.idReserva);
  const page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const contentLeft = 30;
  const contentRight = PAGE_WIDTH - 30;
  const contentWidth = contentRight - contentLeft;
  const headerRight = PAGE_WIDTH - MARGIN;

  page.drawRectangle({
    x: 0,
    y: 0,
    width: PAGE_WIDTH,
    height: PAGE_HEIGHT,
    color: COLORS.background,
  });
  page.drawRectangle({
    x: contentLeft,
    y: PAGE_HEIGHT - 28,
    width: contentWidth,
    height: 4,
    color: COLORS.accent,
  });

  dibujarLogo(page, bold, 43);

  const codigoWidth = bold.widthOfTextAtSize(codigo, 11) + 26;
  page.drawRectangle({
    x: headerRight - codigoWidth,
    y: PAGE_HEIGHT - 45 - 28,
    width: codigoWidth,
    height: 28,
    color: COLORS.accentSoft,
  });
  dibujarTextoAjustado(
    page,
    codigo,
    headerRight - codigoWidth + 13,
    53,
    codigoWidth - 26,
    11,
    9,
    bold,
    COLORS.accentInk,
  );
  dibujarLinea(page, 96, MARGIN, headerRight);

  dibujarTexto(page, "BOLETO DE ENTRADA", MARGIN, 112, 9, bold, COLORS.accent);
  dibujarTextoAjustado(
    page,
    datos.pelicula,
    MARGIN,
    137,
    PAGE_WIDTH - MARGIN * 2,
    22,
    13,
    bold,
  );

  const cardTop = 185;
  const cardGap = 10;
  const cardWidth = (PAGE_WIDTH - MARGIN * 2 - cardGap * 2) / 3;
  const cardHeight = 62;
  const salaCardX = MARGIN + cardWidth + cardGap;
  const classificationCardX = salaCardX + cardWidth + cardGap;
  for (const x of [MARGIN, salaCardX, classificationCardX]) {
    page.drawRectangle({
      x,
      y: PAGE_HEIGHT - cardTop - cardHeight,
      width: cardWidth,
      height: cardHeight,
      color: COLORS.soft,
    });
  }
  dibujarTexto(page, "FUNCIÓN", MARGIN + 14, cardTop + 11, 8, bold, COLORS.muted);
  dibujarTextoAjustado(
    page,
    `${fechaLegible(datos.fecha)} · ${datos.hora.slice(0, 5)} hrs`,
    MARGIN + 14,
    cardTop + 30,
    cardWidth - 28,
    12,
    9,
    bold,
  );
  const salaX = salaCardX + 12;
  dibujarTexto(page, "SALA", salaX, cardTop + 11, 8, bold, COLORS.muted);
  dibujarTextoAjustado(
    page,
    datos.sala,
    salaX,
    cardTop + 30,
    cardWidth - 24,
    12,
    8,
    bold,
  );
  const clasificacionX = classificationCardX + 12;
  dibujarTexto(page, "CLASIFICACIÓN", clasificacionX, cardTop + 11, 7, bold, COLORS.muted);
  dibujarTextoAjustado(
    page,
    datos.clasificacion || "Sin clasificación",
    clasificacionX,
    cardTop + 30,
    cardWidth - 24,
    11,
    8,
    bold,
  );

  dibujarTexto(page, "COMPRADOR", MARGIN, 269, 8, bold, COLORS.muted);
  dibujarTextoAjustado(
    page,
    datos.comprador,
    MARGIN,
    285,
    PAGE_WIDTH - MARGIN * 2,
    12,
    9,
    bold,
  );

  const totalTop = 319;
  const totalHeight = 54;
  page.drawRectangle({
    x: MARGIN,
    y: PAGE_HEIGHT - totalTop - totalHeight,
    width: PAGE_WIDTH - MARGIN * 2,
    height: totalHeight,
    color: COLORS.accentSoft,
  });
  page.drawRectangle({
    x: MARGIN,
    y: PAGE_HEIGHT - totalTop - totalHeight,
    width: 4,
    height: totalHeight,
    color: COLORS.accent,
  });
  dibujarTexto(page, "TOTAL PAGADO", MARGIN + 16, totalTop + 12, 8, bold, COLORS.muted);
  dibujarTextoAjustado(
    page,
    quetzales(datos.totalPagado),
    MARGIN + 16,
    totalTop + 27,
    PAGE_WIDTH - MARGIN * 2 - 32,
    16,
    12,
    bold,
    COLORS.accentInk,
  );

  const seatsTop = 394;
  dibujarTexto(page, "ASIENTOS RESERVADOS", MARGIN, seatsTop, 10, bold);
  const seats = datos.asientos;
  const tableTop = 414;
  const headerHeight = 23;
  const rowHeight = 22;
  const renderedRows = Math.max(seats.length, 1);
  page.drawRectangle({
    x: MARGIN,
    y: PAGE_HEIGHT - tableTop - headerHeight,
    width: PAGE_WIDTH - MARGIN * 2,
    height: headerHeight,
    color: COLORS.surface,
  });
  dibujarTexto(page, "ASIENTO", MARGIN + 12, tableTop + 7, 8, bold, COLORS.ink);
  dibujarTexto(
    page,
    "TIPO DE ENTRADA",
    MARGIN + 130,
    tableTop + 7,
    8,
    bold,
    COLORS.ink,
  );

  if (seats.length === 0) {
    dibujarTexto(page, "No hay asientos asociados a esta reserva.", MARGIN + 12, tableTop + headerHeight + 6, 9, regular, COLORS.muted);
  }

  seats.forEach((asiento, index) => {
    const rowTop = tableTop + headerHeight + index * rowHeight;
    if (index % 2 === 0) {
      page.drawRectangle({
        x: MARGIN,
        y: PAGE_HEIGHT - rowTop - rowHeight,
        width: PAGE_WIDTH - MARGIN * 2,
        height: rowHeight,
        color: COLORS.soft,
      });
    }
    dibujarTexto(page, `${asiento.fila}${asiento.numero}`, MARGIN + 12, rowTop + 6, 9, bold);
    dibujarTextoAjustado(
      page,
      etiquetaTipoEntrada(asiento.tipoEntrada),
      MARGIN + 130,
      rowTop + 6,
      PAGE_WIDTH - MARGIN * 2 - 142,
      9,
      8,
      regular,
    );
  });

  const qrPanelTop = tableTop + headerHeight + renderedRows * rowHeight + 14;
  const qrPanelHeight = 108;
  page.drawRectangle({
    x: MARGIN,
    y: PAGE_HEIGHT - qrPanelTop - qrPanelHeight,
    width: PAGE_WIDTH - MARGIN * 2,
    height: qrPanelHeight,
    color: COLORS.soft,
  });
  page.drawImage(qrImage, {
    x: MARGIN + 10,
    y: PAGE_HEIGHT - qrPanelTop - 98,
    width: 88,
    height: 88,
  });
  dibujarTexto(page, "PRESENTA TU BOLETO EN LA ENTRADA", MARGIN + 112, qrPanelTop + 24, 8, bold, COLORS.muted);
  dibujarTextoAjustado(
    page,
    "Muestra este código QR al ingresar a la sala.",
    MARGIN + 112,
    qrPanelTop + 43,
    PAGE_WIDTH - MARGIN * 2 - 130,
    10,
    8,
    regular,
  );
  dibujarTextoAjustado(
    page,
    `Reserva ${codigo}`,
    MARGIN + 112,
    qrPanelTop + 66,
    PAGE_WIDTH - MARGIN * 2 - 130,
    11,
    9,
    bold,
  );

  dibujarLinea(page, 803, MARGIN, headerRight);
  dibujarTexto(page, "Órbita Cinema · Gracias por tu compra", MARGIN, 811, 8, regular, COLORS.muted);
  dibujarTextoAjustado(
    page,
    "Conserva este boleto hasta el ingreso.",
    PAGE_WIDTH - MARGIN - 200,
    811,
    200,
    8,
    7,
    regular,
    COLORS.muted,
  );

  return pdf.save();
}
