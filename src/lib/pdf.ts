import "server-only";
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from "pdf-lib";
import QRCode from "qrcode";
import { numeroReserva, quetzales } from "@/lib/compra";

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 48;

const COLORS = {
  ink: rgb(0.1, 0.12, 0.16),
  muted: rgb(0.38, 0.41, 0.46),
  line: rgb(0.86, 0.87, 0.89),
  accent: rgb(0.85, 0.16, 0.2),
  light: rgb(0.97, 0.97, 0.98),
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

function dibujarLogo(page: PDFPage, regular: PDFFont, bold: PDFFont, top = 32) {
  const x = MARGIN;
  const centerY = PAGE_HEIGHT - top - 20;

  page.drawEllipse({
    x,
    y: centerY - 15,
    xScale: 20,
    yScale: 15,
    borderColor: COLORS.accent,
    borderWidth: 1.8,
  });
  page.drawEllipse({
    x: x + 8,
    y: centerY - 4,
    xScale: 4,
    yScale: 4,
    color: COLORS.accent,
  });
  page.drawLine({
    start: { x: x - 3, y: centerY },
    end: { x: x + 23, y: centerY },
    thickness: 1,
    color: COLORS.accent,
  });
  dibujarTexto(page, "ÓRBITA", x + 34, top + 2, 15, bold, COLORS.ink);
  dibujarTexto(page, "CINEMA", x + 34, top + 19, 9, regular, COLORS.muted);
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
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const qrBytes = await QRCode.toBuffer(datos.codigoQr, {
    type: "png",
    margin: 1,
    width: 240,
  });
  const qrImage = await pdf.embedPng(qrBytes);
  const codigo = numeroReserva(datos.idReserva);
  let page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = 0;
  let pagina = 0;

  const nuevaPagina = (continuacion = false) => {
    if (pagina > 0) page = pdf.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    pagina += 1;
    dibujarLogo(page, regular, bold);
    dibujarTexto(page, codigo, PAGE_WIDTH - MARGIN - 110, 40, 12, bold, COLORS.accent, {
      maxWidth: 110,
    });
    if (continuacion) {
      dibujarTexto(page, "Continuacion del boleto", MARGIN, 104, 13, bold);
      page.drawLine({
        start: { x: MARGIN, y: PAGE_HEIGHT - 132 },
        end: { x: PAGE_WIDTH - MARGIN, y: PAGE_HEIGHT - 132 },
        thickness: 1,
        color: COLORS.line,
      });
      y = 154;
    } else {
      dibujarTexto(page, "BOLETO DE ENTRADA", MARGIN, 100, 9, bold, COLORS.accent);
      dibujarTexto(page, datos.pelicula, MARGIN, 124, 23, bold, COLORS.ink, {
        maxWidth: PAGE_WIDTH - 2 * MARGIN,
        lineHeight: 27,
      });
      dibujarTexto(
        page,
        `Clasificación: ${datos.clasificacion || "No especificada"}`,
        MARGIN,
        164,
        11,
        regular,
        COLORS.muted,
      );
      page.drawLine({
        start: { x: MARGIN, y: PAGE_HEIGHT - 192 },
        end: { x: PAGE_WIDTH - MARGIN, y: PAGE_HEIGHT - 192 },
        thickness: 1,
        color: COLORS.line,
      });

      dibujarTexto(page, "FUNCIÓN", MARGIN, 211, 9, bold, COLORS.muted);
      dibujarTexto(
        page,
        `${fechaLegible(datos.fecha)}  |  ${datos.hora.slice(0, 5)} hrs`,
        MARGIN,
        228,
        12,
        bold,
      );
      dibujarTexto(page, "SALA", PAGE_WIDTH / 2, 211, 9, bold, COLORS.muted);
      dibujarTexto(page, datos.sala, PAGE_WIDTH / 2, 228, 12, bold, COLORS.ink, {
        maxWidth: PAGE_WIDTH / 2 - MARGIN,
      });

      dibujarTexto(page, "COMPRADOR", MARGIN, 271, 9, bold, COLORS.muted);
      dibujarTexto(page, datos.comprador, MARGIN, 288, 12, bold, COLORS.ink, {
        maxWidth: PAGE_WIDTH - 2 * MARGIN,
        lineHeight: 15,
      });

      page.drawRectangle({
        x: MARGIN,
        y: PAGE_HEIGHT - 373,
        width: PAGE_WIDTH - 2 * MARGIN,
        height: 48,
        color: COLORS.light,
        borderColor: COLORS.line,
        borderWidth: 0.7,
      });
      dibujarTexto(page, "TOTAL PAGADO", MARGIN + 12, 338, 9, bold, COLORS.muted);
      dibujarTexto(
        page,
        quetzales(datos.totalPagado),
        PAGE_WIDTH - MARGIN - 150,
        334,
        16,
        bold,
        COLORS.accent,
        {
          maxWidth: 138,
        },
      );

      dibujarTexto(page, "ASIENTOS RESERVADOS", MARGIN, 399, 10, bold);
      y = 427;
    }
    dibujarEncabezadoAsientos(page, bold, y);
    y += 30;
  };

  function dibujarEncabezadoAsientos(target: PDFPage, boldFont: PDFFont, top: number) {
    target.drawRectangle({
      x: MARGIN,
      y: PAGE_HEIGHT - top - 24,
      width: PAGE_WIDTH - 2 * MARGIN,
      height: 24,
      color: COLORS.light,
    });
    dibujarTexto(target, "ASIENTO", MARGIN + 10, top + 6, 8, boldFont, COLORS.muted);
    dibujarTexto(target, "TIPO DE ENTRADA", MARGIN + 112, top + 6, 8, boldFont, COLORS.muted);
  }

  nuevaPagina();
  for (const asiento of datos.asientos) {
    if (y + 24 > PAGE_HEIGHT - 70) {
      nuevaPagina(true);
    }
    dibujarTexto(page, `${asiento.fila}${asiento.numero}`, MARGIN + 10, y + 5, 10, bold);
    dibujarTexto(page, etiquetaTipoEntrada(asiento.tipoEntrada), MARGIN + 112, y + 5, 10, regular);
    page.drawLine({
      start: { x: MARGIN, y: PAGE_HEIGHT - y - 22 },
      end: { x: PAGE_WIDTH - MARGIN, y: PAGE_HEIGHT - y - 22 },
      thickness: 0.5,
      color: COLORS.line,
    });
    y += 25;
  }

  if (y + 145 > PAGE_HEIGHT - 45) {
    nuevaPagina(true);
  }
  const qrTop = y + 17;
  page.drawImage(qrImage, {
    x: MARGIN,
    y: PAGE_HEIGHT - qrTop - 112,
    width: 112,
    height: 112,
  });
  dibujarTexto(
    page,
    "Presenta este código QR en la entrada.",
    MARGIN + 130,
    qrTop + 22,
    10,
    regular,
    COLORS.muted,
    {
      maxWidth: PAGE_WIDTH - MARGIN * 2 - 130,
    },
  );
  dibujarTexto(page, `Reserva ${codigo}`, MARGIN + 130, qrTop + 45, 12, bold, COLORS.ink);
  dibujarTexto(
    page,
    `Pagina ${pagina}`,
    PAGE_WIDTH - MARGIN - 55,
    PAGE_HEIGHT - 34,
    8,
    regular,
    COLORS.muted,
  );

  return pdf.save();
}
