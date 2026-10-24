import { NextResponse } from "next/server";
import { assertRol } from "@/lib/auth/guard";
import { ROLES_ADMIN } from "@/lib/permisos";
import { parseFiltros } from "@/lib/reportes";
import { construirExcel } from "@/lib/reportes-excel";
import { consultarReporte, listPeliculasReporte } from "@/lib/db/reportes";

/**
 * Descarga del reporte en Excel (SCRUM-142). Recibe los MISMOS filtros que la pantalla y vuelve a
 * ejecutar la misma consulta, así el archivo corresponde a los resultados consultados.
 *
 * Solo Administrador: el rol se verifica AQUÍ en el servidor (no basta con ocultar el botón) y,
 * si no cumple, no se consulta ni se devuelve ningún dato. El reporte solo lee; no modifica nada.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const sinPermiso = await assertRol(ROLES_ADMIN);
  if (sinPermiso) {
    const sinSesion = sinPermiso.includes("iniciar sesión");
    return NextResponse.json({ error: sinPermiso }, { status: sinSesion ? 401 : 403 });
  }

  const params = Object.fromEntries(new URL(request.url).searchParams);
  const r = parseFiltros(params);
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: 400 });

  try {
    const [filas, peliculas] = await Promise.all([consultarReporte(r.filtros), listPeliculasReporte()]);
    if (filas.length === 0) {
      return NextResponse.json({ error: "No se encontraron resultados para descargar." }, { status: 404 });
    }
    const nombre = r.filtros.idPelicula
      ? (peliculas.find((p) => p.id === r.filtros.idPelicula)?.titulo ?? null)
      : null;
    const archivo = await construirExcel(r.filtros, filas, nombre);
    const hoy = new Date().toISOString().slice(0, 10);
    return new NextResponse(new Uint8Array(archivo), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="reporte-${r.filtros.tipo}-${hoy}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "No se pudo generar el reporte." }, { status: 500 });
  }
}
