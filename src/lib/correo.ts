import "server-only";
import QRCode from "qrcode";
import { numeroReserva, quetzales } from "@/lib/compra";
import type { DatosBoleto } from "@/lib/pdf";

const REMITENTE_DEFECTO = "Órbita Cinema <onboarding@resend.dev>";

const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

function etiquetaTipoEntrada(tipo: string): string {
  switch (tipo) {
    case "adulto":
      return "Adulto";
    case "tercera_edad":
      return "3ra. Edad";
    case "nino":
      return "Nino";
    default:
      return tipo;
  }
}

function fechaLegible(fecha: string): string {
  const [anio, mes, dia] = fecha.split("-");
  return anio && mes && dia ? `${dia}/${mes}/${anio}` : fecha;
}

export async function enviarBoletoPorCorreo(
  correoComprador: string,
  datos: DatosBoleto,
  pdfBytes: Uint8Array,
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[correo] RESEND_API_KEY no configurada; se omite el envío del boleto.");
    return false;
  }

  try {
    const codigo = numeroReserva(datos.idReserva);
    const qr = await QRCode.toBuffer(datos.codigoQr, {
      type: "png",
      margin: 1,
      width: 240,
    });
    const listaAsientos = datos.asientos
      .map(
        (asiento) =>
          `${asiento.fila}${asiento.numero} (${etiquetaTipoEntrada(asiento.tipoEntrada)})`,
      )
      .join(", ");
    const filas: [string, string][] = [
      ["Película", datos.pelicula],
      ["Clasificación", datos.clasificacion || "No especificada"],
      ["Función", `${fechaLegible(datos.fecha)}, ${datos.hora.slice(0, 5)} hrs`],
      ["Sala", datos.sala],
      ["Asientos", listaAsientos || "—"],
      ["Total pagado", quetzales(datos.totalPagado)],
      ["Número de reserva", codigo],
    ];
    const htmlFilas = filas
      .map(
        ([etiqueta, valor]) =>
          `<tr><td style="padding:6px 0;color:#a1a1aa;">${esc(etiqueta)}</td><td style="padding:6px 0;text-align:right;color:#ffffff;">${esc(valor)}</td></tr>`,
      )
      .join("");
    const html = `
      <body style="margin:0;background:#0f0f10;font-family:Arial,Helvetica,sans-serif;">
        <div style="max-width:560px;margin:0 auto;padding:24px;">
          <div style="background:#1a1a1c;border-radius:12px;padding:32px;color:#e5e5e7;">
            <h1 style="margin:0 0 4px;font-size:20px;color:#ffffff;">Órbita Cinema</h1>
            <p style="margin:0 0 24px;color:#a1a1aa;">¡Gracias por tu compra, ${esc(datos.comprador)}!</p>
            <table style="width:100%;border-collapse:collapse;font-size:14px;color:#e5e5e7;">
              ${htmlFilas}
            </table>
            <div style="text-align:center;margin-top:24px;">
              <img src="cid:codigo-qr" alt="Código QR del boleto" width="180" height="180"
                   style="display:block;margin:0 auto;background:#ffffff;padding:8px;border-radius:8px;" />
              <p style="margin:8px 0 0;font-size:12px;color:#a1a1aa;">
                Presenta este código QR en la entrada. Adjuntamos tu boleto en PDF.
              </p>
            </div>
          </div>
          <p style="font-size:12px;color:#71717a;text-align:center;margin-top:16px;">
            Órbita Cinema · Sistema académico de reservación
          </p>
        </div>
      </body>`;

    const respuesta = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `boleto-${datos.idReserva}`,
      },
      signal: AbortSignal.timeout(10_000),
      body: JSON.stringify({
        from: process.env.RESEND_FROM ?? REMITENTE_DEFECTO,
        to: [correoComprador],
        subject: `Tu boleto de Órbita Cinema — ${codigo}`,
        html,
        attachments: [
          {
            filename: `boleto-${codigo}.pdf`,
            content: Buffer.from(pdfBytes).toString("base64"),
            content_type: "application/pdf",
          },
          {
            filename: `codigo-qr-${codigo}.png`,
            content: qr.toString("base64"),
            content_id: "codigo-qr",
            content_type: "image/png",
            disposition: "inline",
          },
        ],
      }),
    });

    if (!respuesta.ok) {
      console.error("[correo] Resend respondió", respuesta.status, await respuesta.text());
      return false;
    }
    return true;
  } catch (error) {
    console.error("[correo] Error enviando el boleto:", error);
    return false;
  }
}
