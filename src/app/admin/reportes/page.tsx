/**
 * Reportes de ventas y reservas — ruta `/admin/reportes` (SCRUM-142, RF-038).
 *
 * Solo Administrador. El Colaborador y el Cliente no entran: `src/middleware.ts` lo bloquea con la
 * matriz de `permisos.ts`, aquí se vuelve a verificar con `exigirRol`, y la descarga
 * (`/admin/reportes/descargar`) lo comprueba otra vez en el servidor (todo con AUTH_GUARD=on).
 *
 * Los filtros viajan en la URL (formulario GET) y la consulta se hace en el servidor; el botón de
 * descarga reutiliza exactamente esos filtros. El reporte solo lee datos: no modifica reservas,
 * entradas ni compras.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { Download } from "lucide-react";
import { exigirRol } from "@/lib/auth/pagina";
import { ROLES_ADMIN } from "@/lib/permisos";
import { consultarReporte, listPeliculasReporte } from "@/lib/db/reportes";
import { quetzales } from "@/lib/compra";
import {
  columnasReporte,
  filtrosAParams,
  parseFiltros,
  totalesReporte,
  valorCelda,
  type FilaReporte,
} from "@/lib/reportes";
import type { SP } from "@/lib/search-params";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Reportes de ventas y reservas | Órbita Cinema",
  description: "Panel de Órbita Cinema para consultar y descargar ventas y reservas por película o función.",
  robots: { index: false, follow: false },
  openGraph: {
    title: "Reportes de ventas y reservas | Órbita Cinema",
    description: "Consulta de ventas y reservas con descarga en Excel.",
  },
};

export default async function Page({ searchParams }: { searchParams: Promise<SP> }) {
  await exigirRol(ROLES_ADMIN, "/admin/reportes");
  const sp = await searchParams;
  const parsed = parseFiltros(sp as Record<string, string | string[] | undefined>);
  const filtros = parsed.filtros;

  const peliculas = await listPeliculasReporte();
  let filas: FilaReporte[] = [];
  let errorConsulta: string | null = parsed.ok ? null : parsed.error;
  if (parsed.ok) {
    try {
      filas = await consultarReporte(filtros);
    } catch {
      errorConsulta = "No se pudo consultar el reporte. Intenta de nuevo.";
    }
  }

  const columnas = columnasReporte(filtros);
  const total = totalesReporte(filas);
  const hayGrupos = columnas.some((c) => c.grupo);
  const hrefDescarga = `/admin/reportes/descargar?${filtrosAParams(filtros).toString()}`;
  const sinResultados = !errorConsulta && filas.length === 0;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl tracking-wide">Reportes de ventas y reservas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Consulta por película o función, incluyendo funciones pasadas, actuales y futuras. Las
          reservas canceladas no se cuentan. Ventas = reservas con pago aprobado; reservas vigentes =
          ventas más compras en curso que aún no vencen.
        </p>
      </header>

      <form method="get" className="card-surface grid gap-4 p-6 sm:grid-cols-2 xl:grid-cols-6">
        <div>
          <label className="label" htmlFor="desde">
            Desde
          </label>
          <input id="desde" name="desde" type="date" className="field" defaultValue={filtros.desde ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="hasta">
            Hasta
          </label>
          <input id="hasta" name="hasta" type="date" className="field" defaultValue={filtros.hasta ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="tipo">
            Mostrar
          </label>
          <select id="tipo" name="tipo" className="field" defaultValue={filtros.tipo}>
            <option value="ambas">Ventas y reservas</option>
            <option value="ventas">Solo ventas</option>
            <option value="reservas">Solo reservas</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="agrupar">
            Consultar por
          </label>
          <select id="agrupar" name="agrupar" className="field" defaultValue={filtros.agrupar}>
            <option value="funcion">Función</option>
            <option value="pelicula">Película</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="pelicula">
            Película
          </label>
          <select id="pelicula" name="pelicula" className="field" defaultValue={filtros.idPelicula ?? ""}>
            <option value="">Todas</option>
            {peliculas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.titulo}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end gap-3">
          <button type="submit" className="btn-primary">
            Consultar
          </button>
          <Link href="/admin/reportes" className="btn-ghost">
            Limpiar
          </Link>
        </div>
      </form>

      <section className="card-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 p-6">
          <h2 className="text-2xl tracking-wide">Resultados</h2>
          {!errorConsulta && filas.length > 0 ? (
            <a href={hrefDescarga} className="btn-primary">
              <Download className="h-4 w-4" /> Descargar Excel
            </a>
          ) : (
            <span aria-disabled="true" className="btn-primary pointer-events-none opacity-50">
              <Download className="h-4 w-4" /> Descargar Excel
            </span>
          )}
        </div>

        {errorConsulta && (
          <p role="alert" className="mx-6 mb-6 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {errorConsulta}
          </p>
        )}

        {sinResultados && (
          <p role="status" className="mx-6 mb-6 rounded-md border border-border bg-surface-2 px-4 py-3 text-sm text-muted-foreground">
            No se encontraron resultados con los filtros seleccionados.
          </p>
        )}

        {!errorConsulta && filas.length > 0 && (
          <div className="overflow-x-auto px-6 pb-6">
            <table className="w-full border-collapse text-sm">
              <thead>
                {hayGrupos && (
                  <tr className="text-center text-xs uppercase tracking-wider text-muted-foreground">
                    {agruparEncabezados(columnas).map((g, i) => (
                      <th key={i} colSpan={g.span} className={`px-4 pt-2 ${g.texto ? "border-b border-border" : ""}`}>
                        {g.texto}
                      </th>
                    ))}
                  </tr>
                )}
                <tr className="bg-surface-2 text-left uppercase tracking-wider text-muted-foreground">
                  {columnas.map((c) => (
                    <th key={c.clave} className={`px-4 py-3 ${c.tipo === "texto" ? "" : "text-right"}`}>
                      {c.titulo}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filas.map((f, i) => (
                  <tr key={`${f.idPelicula}-${f.idFuncion}-${i}`} className="border-b border-border">
                    {columnas.map((c) => (
                      <td key={c.clave} className={`px-4 py-3 ${c.tipo === "texto" ? "" : "text-right tabular-nums"}`}>
                        {formato(valorCelda(f, c.clave), c.tipo)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-semibold">
                  {columnas.map((c) => (
                    <td key={c.clave} className={`px-4 py-3 ${c.tipo === "texto" ? "" : "text-right tabular-nums text-primary"}`}>
                      {c.tipo === "texto"
                        ? c.clave === "pelicula"
                          ? "TOTAL"
                          : ""
                        : formato(valorCelda(total, c.clave), c.tipo)}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function formato(valor: string | number, tipo: "texto" | "entero" | "moneda"): string {
  if (typeof valor === "string") return valor;
  return tipo === "moneda" ? quetzales(valor) : valor.toLocaleString("es-GT");
}

/** Celdas del encabezado de grupos: columnas contiguas con el mismo grupo se unen. */
function agruparEncabezados(columnas: { grupo?: string }[]): { texto: string; span: number }[] {
  const out: { texto: string; span: number }[] = [];
  for (const c of columnas) {
    const texto = c.grupo ?? "";
    const ultimo = out[out.length - 1];
    if (ultimo && ultimo.texto === texto) ultimo.span += 1;
    else out.push({ texto, span: 1 });
  }
  return out;
}
