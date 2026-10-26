import { NextResponse } from "next/server";
import { crearPdf } from "@/lib/pdf";
import { BoletoNoDisponibleError, obtenerDatosBoleto } from "@/lib/boleto";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ idReserva: string }> },
) {
  const idReserva = Number((await params).idReserva);
  if (!Number.isSafeInteger(idReserva) || idReserva < 1) {
    return NextResponse.json({ error: "El número de reserva no es válido." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Debes iniciar sesión." }, { status: 401 });
  }

  try {
    const { datos } = await obtenerDatosBoleto(idReserva, user.id);
    const pdf = await crearPdf(datos);
    return new NextResponse(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="boleto-ORB-${String(idReserva).padStart(6, "0")}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof BoletoNoDisponibleError) {
      return NextResponse.json({ error: "El boleto no está disponible para esta reserva." }, { status: 404 });
    }
    console.error("[perfil/boleto] No se pudo generar el boleto:", error);
    return NextResponse.json({ error: "No se pudo generar el boleto. Inténtalo de nuevo." }, { status: 500 });
  }
}
