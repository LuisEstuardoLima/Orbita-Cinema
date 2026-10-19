import "server-only";
import QRCode from "qrcode";
import { createAdminClient } from "@/lib/supabase/admin";
import { etiquetaAsiento } from "@/lib/bloqueo";
import { fechaCortaFuncion, numeroReserva, quetzales } from "@/lib/compra";

/**
 * Envío del boleto por correo (Resend). Best-effort: NUNCA lanza excepción y
 * jamás revierte la compra — la reserva ya está confirmada cuando se llama;
 * si el correo falla, solo se registra en los logs y el cliente ve su número
 * de reserva en pantalla.
 *
 * El QR codifica el token `codigo_qr` del boleto (sin datos personales).
 * En desarrollo, Resend solo permite enviar desde onboarding@resend.dev hacia
 * el correo dueño de la cuenta; configurable con RESEND_FROM en producción.
 */

const REMITENTE_DEFECTO = "Órbita Cinema <onboarding@resend.dev>";

/** Escapa caracteres especiales para incrustar texto de usuario en el HTML. */
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export async function enviarBoletoPorCorreo(idReserva: number): Promise<boolean> {
  try {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      console.warn("[correo] RESEND_API_KEY no configurada; se omite el envío del boleto.");
      return false;
    }

    const admin = createAdminClient();

    // Datos de la compra CONFIRMADA, con película y sala embebidas por FK.
    const { data: reserva, error: errReserva } = await admin
      .from("reserva")
      .select(
        `id_reserva, nombre_comprador, correo_comprador, total,
         funcion:funcion!inner(fecha, hora, sala:sala(nombre), pelicula:pelicula(titulo))`,
      )
      .eq("id_reserva", idReserva)
      .maybeSingle();
    if (errReserva || !reserva || !reserva.funcion || !reserva.correo_comprador) {
      console.error("[correo] No se pudo leer la reserva:", errReserva?.message ?? "sin datos");
      return false;
    }

    const { data: detalles } = await admin
      .from("detalle_reserva")
      .select("asiento:asiento(fila, numero)")
      .eq("id_reserva", idReserva);

    const { data: boleto } = await admin
      .from("boleto")
      .select("codigo_qr")
      .eq("id_reserva", idReserva)
      .maybeSingle();
    if (!boleto) {
      console.error("[correo] La reserva no tiene boleto.");
      return false;
    }

    const funcion = reserva.funcion as unknown as {
      fecha: string;
      hora: string;
      sala: { nombre: string } | null;
      pelicula: { titulo: string } | null;
    };
    const asientos = (
      (detalles ?? []) as unknown as { asiento: { fila: string; numero: number } | null }[]
    )
      .filter((d) => d.asiento !== null)
      .map((d) => etiquetaAsiento(d.asiento!.fila, d.asiento!.numero))
      .join(", ");

    const codigo = numeroReserva(reserva.id_reserva);
    const titulo = funcion.pelicula?.titulo ?? "Película";
    const sala = funcion.sala?.nombre ?? "—";
    const horario = `${fechaCortaFuncion(funcion.fecha)}, ${funcion.hora.slice(0, 5)} hrs`;

    // QR del token del boleto, como PNG embebido (cid:) y adjunto.
    const qr = await QRCode.toBuffer(boleto.codigo_qr as string, {
      type: "png",
      margin: 1,
      width: 240,
    });

    const html = `
      <body style="margin:0;background:#0f0f10;font-family:Arial,Helvetica,sans-serif;">
        <div style="max-width:560px;margin:0 auto;padding:24px;">
          <div style="background:#1a1a1c;border-radius:12px;padding:32px;color:#e5e5e7;">
            <h1 style="margin:0 0 4px;font-size:20px;color:#ffffff;">Órbita Cinema</h1>
            <p style="margin:0 0 24px;color:#a1a1aa;">¡Gracias por tu compra, ${esc(reserva.nombre_comprador)}!</p>
            <p style="margin:0 0 4px;font-size:13px;color:#a1a1aa;">Boleto para</p>
            <p style="margin:0 0 20px;font-size:18px;font-weight:bold;color:#ffffff;">${esc(titulo)}</p>
            <table style="width:100%;border-collapse:collapse;font-size:14px;color:#e5e5e7;">
              <tr><td style="padding:4px 0;color:#a1a1aa;">Función</td><td style="text-align:right;">${esc(horario)}</td></tr>
              <tr><td style="padding:4px 0;color:#a1a1aa;">Sala</td><td style="text-align:right;">${esc(sala)}</td></tr>
              <tr><td style="padding:4px 0;color:#a1a1aa;">Asientos</td><td style="text-align:right;">${esc(asientos || "—")}</td></tr>
              <tr><td style="padding:4px 0;color:#a1a1aa;">Total pagado</td><td style="text-align:right;">${quetzales(Number(reserva.total))}</td></tr>
              <tr><td style="padding:12px 0 4px;color:#a1a1aa;">Número de reserva</td><td style="padding:12px 0 4px;text-align:right;font-weight:bold;color:#ffffff;">${codigo}</td></tr>
            </table>
            <div style="text-align:center;margin-top:24px;">
              <img src="cid:codigo-qr" alt="Código QR del boleto" width="180" height="180"
                   style="display:block;margin:0 auto;background:#ffffff;padding:8px;border-radius:8px;" />
              <p style="margin:8px 0 0;font-size:12px;color:#a1a1aa;">
                Presenta este código QR en la entrada. El archivo PNG viene adjunto al correo.
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
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM ?? REMITENTE_DEFECTO,
        to: [reserva.correo_comprador],
        subject: `Tu boleto de Órbita Cinema — ${codigo}`,
        html,
        attachments: [
          {
            filename: `boleto-${codigo}.png`,
            content: qr.toString("base64"),
            content_id: "codigo-qr",
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
  } catch (e) {
    console.error("[correo] Error inesperado enviando el boleto:", e);
    return false;
  }
}
