/**
 * Reporte de ocupación por sala — ruta `/admin/reportes/ocupacion` (SCRUM-143, RF-039).
 *
 * Solo Administrador (Colaborador y Cliente no entran: middleware + `exigirRol` aquí + `assertRol`
 * en la descarga, todo con AUTH_GUARD=on). Se localiza la función con filtros (fecha, película,
 * función, sala) y se muestra su ocupación: capacidad, ocupados/reservados, disponibles,
 * porcentaje y el detalle de cada asiento. Solo lee datos; no modifica reservas ni asientos.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { Download } from "lucide-react";
import { exigirRol } from "@/lib/auth/pagina";
import { ROLES_ADMIN } from "@/lib/permisos";
import { ahoraGuatemala } from "@/lib/fechas";
import { fechaCorta } from "@/lib/reportes";
import { listPeliculasReporte } from "@/lib/db/reportes";
import {
  LIMITE_FUNCIONES,
  consultarOcupacionFuncion,
  listFuncionesOcupacion,
  listSalasOcupacion,
} from "@/lib/db/ocupacion";
import {
  ETIQUETA_ESTADO,
  ETIQUETA_TIPO_ASIENTO,
  ETIQUETA_ORIGEN,
  agruparPorFila,
  etiquetaAsiento,
  etiquetaFuncionOpcion,
  filtrosOcupacionAParams,
  formatoPorcentaje,
  parseFiltrosOcupacion,
  type FuncionOpcion,
  type ReporteOcupacion,
} from "@/lib/ocupacion";
import type { SP } from "@/lib/search-params";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ocupación por sala | Órbita Cinema",
  description: "Panel de Órbita Cinema para consultar y descargar la ocupación de una función.",
  robots: { index: false, follow: false },
  openGraph: {
    title: "Ocupación por sala | Órbita Cinema",
    description: "Capacidad, ocupación y detalle de asientos por función, con descarga en Excel.",
  },
};

export default async function Page({ searchParams }: { searchParams: Promise<SP> }) {
  await exigirRol(ROLES_ADMIN, "/admin/reportes/ocupacion");
  const sp = (await searchParams) as Record<string, string | string[] | undefined>;
  const hoy = ahoraGuatemala().fecha;
  const parsed = parseFiltrosOcupacion(sp, hoy);
  const filtros = parsed.filtros;

  const [peliculas, salas] = await Promise.all([listPeliculasReporte(), listSalasOcupacion()]);

  let funciones: FuncionOpcion[] = [];
  let truncado = false;
  let reporte: ReporteOcupacion | null = null;
  let error: string | null = parsed.ok ? null : parsed.error;

  if (parsed.ok) {
    try {
      const lista = await listFuncionesOcupacion(filtros);
      funciones = lista.funciones;
      truncado = lista.truncado;
      if (filtros.idFuncion !== null) reporte = await consultarOcupacionFuncion(filtros.idFuncion);
    } catch {
      error = "No se pudo consultar el reporte. Intenta de nuevo.";
    }
  }

  const sinFunciones = !error && funciones.length === 0 && filtros.idFuncion === null;
  const funcionNoEncontrada = !error && filtros.idFuncion !== null && reporte === null;
  const hrefVer = (id: number) =>
    `/admin/reportes/ocupacion?${filtrosOcupacionAParams({ ...filtros, idFuncion: id }).toString()}`;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl tracking-wide">Ocupación por sala</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Busca una función (pasada, actual o futura) y consulta su capacidad, asientos ocupados y
          disponibles, porcentaje de ocupación y el estado de cada asiento. Ocupado = reservado
          (pagado) o en una compra en curso que aún no vence.
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
        <div>
          <label className="label" htmlFor="sala">
            Sala
          </label>
          <select id="sala" name="sala" className="field" defaultValue={filtros.idSala ?? ""}>
            <option value="">Todas</option>
            {salas.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="funcion">
            Función
          </label>
          <select id="funcion" name="funcion" className="field" defaultValue={filtros.idFuncion ?? ""}>
            <option value="">Elige una función…</option>
            {funciones.map((f) => (
              <option key={f.id} value={f.id}>
                {etiquetaFuncionOpcion(f)}
              </option>
            ))}
            {filtros.idFuncion !== null && !funciones.some((f) => f.id === filtros.idFuncion) && (
              <option value={filtros.idFuncion}>Función #{filtros.idFuncion}</option>
            )}
          </select>
        </div>
        <div className="flex items-end gap-3">
          <button type="submit" className="btn-primary">
            Consultar
          </button>
          <Link href="/admin/reportes/ocupacion" className="btn-ghost">
            Limpiar
          </Link>
        </div>
      </form>

      {error && (
        <p role="alert" className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {sinFunciones && (
        <p role="status" className="card-surface px-6 py-4 text-sm text-muted-foreground">
          No se encontraron funciones con los filtros seleccionados.
        </p>
      )}

      {funcionNoEncontrada && (
        <p role="status" className="card-surface px-6 py-4 text-sm text-muted-foreground">
          No se encontró la función seleccionada. No hay datos de ocupación para mostrar.
        </p>
      )}

      {reporte && <DetalleOcupacion r={reporte} />}

      {!error && funciones.length > 0 && (
        <section className="card-surface">
          <h2 className="p-6 pb-3 text-2xl tracking-wide">Funciones encontradas ({funciones.length})</h2>
          {truncado && (
            <p className="mx-6 mb-3 text-xs text-muted-foreground">
              Se muestran las {LIMITE_FUNCIONES} más recientes; acota las fechas para ver otras.
            </p>
          )}
          <div className="max-h-96 overflow-auto px-6 pb-6">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-surface-2 text-left uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3">Fecha</th>
                  <th className="px-4 py-3">Hora</th>
                  <th className="px-4 py-3">Película</th>
                  <th className="px-4 py-3">Sala</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {funciones.map((f) => (
                  <tr key={f.id} className={`border-b border-border ${f.id === filtros.idFuncion ? "bg-primary/10" : ""}`}>
                    <td className="px-4 py-3">{fechaCorta(f.fecha)}</td>
                    <td className="px-4 py-3">{f.hora}</td>
                    <td className="px-4 py-3">
                      {f.pelicula}
                      {!f.activa && <span className="ml-2 text-xs text-destructive">(cancelada)</span>}
                    </td>
                    <td className="px-4 py-3">{f.sala}</td>
                    <td className="px-4 py-3 text-right">
                      <Link href={hrefVer(f.id)} className="font-semibold text-primary hover:underline">
                        Ver ocupación
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function DetalleOcupacion({ r }: { r: ReporteOcupacion }) {
  const { resumen: s, funcion: f } = r;
  const filas = agruparPorFila(r.asientos);
  return (
    <section className="card-surface p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl tracking-wide">{f.pelicula}</h2>
          <p className="text-sm text-muted-foreground">
            {fechaCorta(f.fecha)} · {f.hora} · {f.sala}
            {!f.activa && <span className="ml-2 text-destructive">(función cancelada)</span>}
          </p>
        </div>
        <a href={`/admin/reportes/ocupacion/descargar?funcion=${f.id}`} className="btn-primary">
          <Download className="h-4 w-4" /> Descargar Excel
        </a>
      </div>

      <dl className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador etiqueta="Capacidad total" valor={s.capacidad.toLocaleString("es-GT")} />
        <Indicador
          etiqueta="Ocupados o reservados"
          valor={s.ocupados.toLocaleString("es-GT")}
          nota={`${s.reservados} reservados · ${s.enCompra} en compra`}
        />
        <Indicador etiqueta="Disponibles" valor={s.disponibles.toLocaleString("es-GT")} />
        <Indicador etiqueta="Ocupación" valor={formatoPorcentaje(s.porcentaje)} destacado />
      </dl>
      <div
        role="progressbar"
        aria-label="Porcentaje de ocupación"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={s.porcentaje}
        className="mt-4 h-2 w-full overflow-hidden rounded-full bg-surface-2"
      >
        <div className="h-full bg-primary" style={{ width: `${Math.min(100, s.porcentaje)}%` }} />
      </div>

      {s.capacidad === 0 ? (
        <p role="status" className="mt-6 text-sm text-muted-foreground">
          Esta sala no tiene asientos configurados, por lo que no hay detalle que mostrar.
        </p>
      ) : (
        <>
          <h3 className="mt-8 text-xl tracking-wide">Detalle de asientos</h3>
          <ul className="mt-3 flex flex-wrap gap-5 text-xs text-muted-foreground">
            <li className="flex items-center gap-2">
              <span className="h-4 w-4 rounded-[4px] border border-primary/50 bg-primary/10" /> Libre
            </li>
            <li className="flex items-center gap-2">
              <span className="h-4 w-4 rounded-[4px] bg-muted-foreground/60" /> Ocupado (reservado)
            </li>
            <li className="flex items-center gap-2">
              <span className="h-4 w-4 rounded-[4px] border border-dashed border-muted-foreground bg-muted-foreground/25" />{" "}
              Ocupado (en compra)
            </li>
            <li className="flex items-center gap-2">
              <span className="h-4 w-4 rounded-[4px] border border-dashed border-border bg-transparent" /> Pasillo
            </li>
            <li className="flex items-center gap-2">
              <span className="h-4 w-4 rounded-[4px] bg-muted-foreground/60" /> Deshabilitado
            </li>
          </ul>

          <div className="mt-4 overflow-x-auto">
            <div className="mx-auto w-fit">
              {filas.map((fila) => (
                <div key={fila.fila} className="mb-1.5 flex items-center gap-2">
                  <span className="w-4 text-xs text-muted-foreground">{fila.fila}</span>
                  <div className="flex gap-1.5">
                    {fila.asientos.map((a) => (
                      <span
                        key={`${a.fila}-${a.columna}`}
                        title={`${a.tipo === "normal" ? etiquetaAsiento(a) : ETIQUETA_TIPO_ASIENTO[a.tipo]} — ${ETIQUETA_ESTADO[a.estado]}`}
                        aria-label={`${a.tipo === "normal" ? etiquetaAsiento(a) : ETIQUETA_TIPO_ASIENTO[a.tipo]} — ${ETIQUETA_ESTADO[a.estado]}`}
                        className={`flex h-8 w-8 select-none items-center justify-center rounded-[4px] text-[11px] font-medium ${
                          a.estado === "ocupado"
                            ? a.origen === "en_compra"
                              ? "border border-dashed border-muted-foreground bg-muted-foreground/25 text-foreground"
                              : "bg-muted-foreground/60 text-background"
                            : a.tipo === "pasillo"
                              ? "border border-dashed border-border bg-transparent text-muted-foreground/50"
                              : a.tipo === "deshabilitado" || a.tipo === "retirado"
                                ? "bg-muted-foreground/60 text-background"
                                : "border border-primary/50 bg-primary/10 text-primary"
                        }`}
                      >
                        {a.tipo === "normal" || a.estado === "ocupado"
                          ? a.numero
                          : a.tipo === "pasillo"
                            ? "·"
                            : "×"}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <details className="mt-6">
            <summary className="cursor-pointer text-sm font-semibold text-primary">
              Ver tabla de asientos ({r.asientos.length})
            </summary>
            <div className="mt-3 max-h-96 overflow-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="sticky top-0 bg-surface-2 text-left uppercase tracking-wider text-muted-foreground">
                    <th className="px-4 py-2">Fila</th>
                    <th className="px-4 py-2">Asiento</th>
                    <th className="px-4 py-2">Columna física</th>
                    <th className="px-4 py-2">Tipo</th>
                    <th className="px-4 py-2">Estado</th>
                    <th className="px-4 py-2">Detalle</th>
                  </tr>
                </thead>
                <tbody>
                  {r.asientos.map((a) => (
                    <tr key={`${a.fila}-${a.columna}`} className="border-b border-border">
                      <td className="px-4 py-2">{a.fila}</td>
                      <td className="px-4 py-2">{a.tipo === "normal" || a.estado === "ocupado" ? etiquetaAsiento(a) : "—"}</td>
                      <td className="px-4 py-2">{a.columna}</td>
                      <td className="px-4 py-2">{ETIQUETA_TIPO_ASIENTO[a.tipo]}</td>
                      <td className={`px-4 py-2 ${a.estado === "ocupado" ? "font-semibold" : "text-muted-foreground"}`}>
                        {ETIQUETA_ESTADO[a.estado]}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">{a.origen ? ETIQUETA_ORIGEN[a.origen] : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </section>
  );
}

function Indicador({
  etiqueta,
  valor,
  nota,
  destacado,
}: {
  etiqueta: string;
  valor: string;
  nota?: string;
  destacado?: boolean;
}) {
  return (
    <div className="rounded-lg bg-surface-2 p-4">
      <dt className="text-xs uppercase tracking-wider text-muted-foreground">{etiqueta}</dt>
      <dd className={`mt-1 text-3xl font-bold tabular-nums ${destacado ? "text-primary" : ""}`}>{valor}</dd>
      {nota && <p className="mt-1 text-xs text-muted-foreground">{nota}</p>}
    </div>
  );
}
