import { NextResponse } from "next/server";
import { assertRol } from "@/lib/auth/guard";
import { ROLES_ADMIN } from "@/lib/permisos";
import { consultarOcupacionFuncion } from "@/lib/db/ocupacion";
import { construirExcelOcupacion } from "@/lib/ocupacion-excel";

/**
 * Descarga del reporte de ocupación en Excel (SCRUM-143). Recibe el id de la función elegida en
 * pantalla y vuelve a ejecutar la misma consulta, así el archivo corresponde a esa función.
 *
 * Solo Administrador: el rol se verifica AQUÍ en el servidor (no basta con ocultar el botón) y,
 * si no cumple, no se consulta ni se devuelve ningún dato. Solo lee; no modifica nada.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const sinPermiso = await assertRol(ROLES_ADMIN);
  if (sinPermiso) {
    const sinSesion = sinPermiso.includes("iniciar sesión");
    return NextResponse.json({ error: sinPermiso }, { status: sinSesion ? 401 : 403 });
  }

  const crudo = new URL(request.url).searchParams.get("funcion")?.trim() ?? "";
  if (!/^\d{1,15}$/.test(crudo) || Number(crudo) <= 0) {
    return NextResponse.json({ error: "La función elegida no es válida." }, { status: 400 });
  }
  const idFuncion = Number(crudo);

  try {
    const reporte = await consultarOcupacionFuncion(idFuncion);
    if (!reporte) {
      return NextResponse.json({ error: "No se encontró la función seleccionada." }, { status: 404 });
    }
    const archivo = await construirExcelOcupacion(reporte);
    return new NextResponse(new Uint8Array(archivo), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="ocupacion-funcion-${idFuncion}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "No se pudo generar el reporte." }, { status: 500 });
  }
}
