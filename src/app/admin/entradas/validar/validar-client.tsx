"use client";

import { useCallback, useRef, useState } from "react";
import { CheckCircle2, QrCode, Search, XCircle } from "lucide-react";
import { EscanerQr } from "@/components/admin/EscanerQr";
import { validarEntrada } from "../actions";
import { numeroReserva, quetzales } from "@/lib/compra";
import type { ModoBusqueda, ResultadoValidacion } from "@/lib/validacion";

type FuncionOpcion = {
  id: number;
  pelicula: string;
  sala: string;
  fecha: string;
  hora: string;
  activa: boolean;
};

type Props = {
  hoy: string;
  funciones: FuncionOpcion[];
  funcionInicial: number | null;
};

const MODOS_MANUALES: { id: ModoBusqueda; etiqueta: string; ayuda: string; placeholder: string }[] = [
  { id: "entrada", etiqueta: "ID de entrada", ayuda: "Número de la entrada (boleto).", placeholder: "Ej. 245" },
  { id: "reserva", etiqueta: "Número de reserva", ayuda: "El que ve el cliente en su confirmación (ORB-000123) o solo el número.", placeholder: "Ej. ORB-001380" },
  { id: "qr", etiqueta: "Código del QR", ayuda: "Pega o digita el código, o usa un lector de QR.", placeholder: "Código del QR" },
];

function etiquetaFuncion(f: FuncionOpcion, hoy: string): string {
  const dia = f.fecha === hoy ? "Hoy" : f.fecha;
  return `${dia} · ${f.hora} · ${f.pelicula} · ${f.sala}${f.activa ? "" : " (cancelada)"}`;
}

export function ValidarEntradasClient({ hoy, funciones, funcionInicial }: Props) {
  const [idFuncion, setIdFuncion] = useState<number | null>(funcionInicial);
  const [pestana, setPestana] = useState<"escaner" | "manual">("escaner");
  const [modo, setModo] = useState<ModoBusqueda>("entrada");
  const [valor, setValor] = useState("");
  const [procesando, setProcesando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoValidacion | null>(null);
  const enCurso = useRef(false); // evita doble envío (doble clic / dos lecturas seguidas)

  const ejecutar = useCallback(
    async (m: ModoBusqueda, v: string) => {
      if (enCurso.current) return;
      if (idFuncion == null) {
        setResultado({ ok: false, motivo: "datos", mensaje: "Selecciona la función para validar el ingreso." });
        return;
      }
      enCurso.current = true;
      setProcesando(true);
      try {
        setResultado(await validarEntrada({ idFuncion, modo: m, valor: v }));
      } catch {
        setResultado({
          ok: false,
          motivo: "error",
          mensaje: "No se pudo completar la validación. Intenta de nuevo; la reserva no fue modificada.",
        });
      } finally {
        enCurso.current = false;
        setProcesando(false);
      }
    },
    [idFuncion],
  );

  const alLeerQr = useCallback((texto: string) => void ejecutar("qr", texto), [ejecutar]);

  const nueva = () => {
    setResultado(null);
    setValor("");
  };

  const funcionSel = funciones.find((f) => f.id === idFuncion) ?? null;
  const modoManual = MODOS_MANUALES.find((x) => x.id === modo) ?? MODOS_MANUALES[0]!;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl tracking-wide">Validación de entradas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Escanea el código QR del boleto o busca la entrada o reserva manualmente. Al validar, se registra
          como utilizada la reserva completa.
        </p>
      </header>

      {funciones.length === 0 ? (
        <section className="card-surface p-6 text-sm text-muted-foreground">
          No hay funciones programadas para hoy ni para los próximos días.
        </section>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
          <section className="card-surface p-6">
            <label className="label" htmlFor="funcion-validar">
              Función
            </label>
            <select
              id="funcion-validar"
              className="field"
              value={idFuncion ?? ""}
              onChange={(e) => {
                setIdFuncion(e.target.value ? Number(e.target.value) : null);
                nueva();
              }}
            >
              {funciones.map((f) => (
                <option key={f.id} value={f.id}>
                  {etiquetaFuncion(f, hoy)}
                </option>
              ))}
            </select>

            <div role="tablist" aria-label="Forma de validar" className="mt-6 flex gap-2 border-b border-border">
              {(
                [
                  { id: "escaner", etiqueta: "Escanear QR", icono: QrCode },
                  { id: "manual", etiqueta: "Búsqueda manual", icono: Search },
                ] as const
              ).map((t) => {
                const Icono = t.icono;
                const activa = pestana === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    aria-selected={activa}
                    onClick={() => {
                      setPestana(t.id);
                      nueva();
                    }}
                    className={`-mb-px flex items-center gap-2 border-b-2 px-4 py-2 text-sm transition-colors ${
                      activa
                        ? "border-primary font-semibold text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icono className="h-4 w-4" />
                    {t.etiqueta}
                  </button>
                );
              })}
            </div>

            <div className="mt-6">
              {pestana === "escaner" ? (
                <EscanerQr activo={resultado === null && !procesando} onCodigo={alLeerQr} />
              ) : (
                <form
                  className="space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void ejecutar(modo, valor);
                  }}
                >
                  <fieldset>
                    <legend className="label">Buscar por</legend>
                    <div className="mt-1 flex flex-wrap gap-4 text-sm">
                      {MODOS_MANUALES.map((m) => (
                        <label key={m.id} className="flex cursor-pointer items-center gap-2">
                          <input
                            type="radio"
                            name="modo-busqueda"
                            checked={modo === m.id}
                            onChange={() => {
                              setModo(m.id);
                              setValor("");
                              setResultado(null);
                            }}
                          />
                          {m.etiqueta}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <div>
                    <label className="label" htmlFor="valor-busqueda">
                      {modoManual.etiqueta}
                    </label>
                    <input
                      id="valor-busqueda"
                      className="field"
                      value={valor}
                      onChange={(e) => setValor(e.target.value)}
                      placeholder={modoManual.placeholder}
                      inputMode={modo === "qr" ? "text" : "numeric"}
                      autoComplete="off"
                      autoFocus
                    />
                    <p className="mt-1 text-xs text-muted-foreground">{modoManual.ayuda}</p>
                  </div>
                  <button type="submit" disabled={procesando || valor.trim() === ""} className="btn-primary">
                    {procesando ? "Validando..." : "Validar entrada"}
                  </button>
                </form>
              )}
            </div>
          </section>

          <aside className="card-surface h-fit p-6" aria-live="polite">
            <h2 className="text-2xl tracking-wide">Resultado</h2>
            {funcionSel && (
              <p className="mt-1 text-xs text-muted-foreground">
                Validando para: {funcionSel.pelicula} · {funcionSel.sala} · {funcionSel.hora}
              </p>
            )}

            {procesando && <p className="mt-6 text-sm text-muted-foreground">Validando...</p>}

            {!procesando && resultado === null && (
              <p className="mt-6 text-sm text-muted-foreground">
                Aún no hay validaciones. Escanea un QR o busca una entrada para ver el resultado.
              </p>
            )}

            {!procesando && resultado && (
              <div
                role={resultado.ok ? "status" : "alert"}
                className={`mt-6 rounded-lg border p-4 ${
                  resultado.ok
                    ? "border-emerald-500 bg-emerald-500/10"
                    : "border-destructive bg-destructive/10"
                }`}
              >
                <p
                  className={`flex items-center gap-2 text-lg font-semibold ${
                    resultado.ok ? "text-emerald-500" : "text-destructive"
                  }`}
                >
                  {resultado.ok ? <CheckCircle2 className="h-6 w-6" /> : <XCircle className="h-6 w-6" />}
                  {resultado.ok ? "Entrada válida: ingreso permitido" : "Validación rechazada"}
                </p>
                {!resultado.ok && <p className="mt-2 text-sm">{resultado.mensaje}</p>}

                {(resultado.ok ? resultado.datos : resultado.datos) && (
                  <dl className="mt-4 space-y-1.5 text-sm">
                    {(() => {
                      const d = resultado.ok ? resultado.datos : resultado.datos!;
                      return (
                        <>
                          <Fila etiqueta="ID de compra" valor={numeroReserva(d.idCompra)} destacado />
                          {d.idEntrada != null && <Fila etiqueta="ID de entrada" valor={`#${d.idEntrada}`} />}
                          <Fila etiqueta="Comprador" valor={d.comprador} />
                          {d.fechaFuncion && (
                            <Fila
                              etiqueta="Función"
                              valor={`${d.fechaFuncion} · ${d.horaFuncion ?? ""}`.trim()}
                            />
                          )}
                          <Fila
                            etiqueta="Asientos"
                            valor={d.asientos.length ? d.asientos.join(", ") : "—"}
                          />
                          <Fila etiqueta="Total" valor={quetzales(d.total)} />
                          {!resultado.ok && resultado.motivo === "ya_utilizada" && d.fechaUso && (
                            <Fila etiqueta="Validada el" valor={formatoFechaHora(d.fechaUso)} />
                          )}
                        </>
                      );
                    })()}
                  </dl>
                )}

                <button type="button" onClick={nueva} className="btn-ghost mt-4 w-full">
                  {pestana === "escaner" ? "Escanear siguiente" : "Nueva búsqueda"}
                </button>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}

function Fila({ etiqueta, valor, destacado }: { etiqueta: string; valor: string; destacado?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-muted-foreground">{etiqueta}:</dt>
      <dd className={`text-right ${destacado ? "font-bold text-primary" : "font-medium"}`}>{valor}</dd>
    </div>
  );
}

function formatoFechaHora(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("es-GT", {
    timeZone: "America/Guatemala",
    dateStyle: "short",
    timeStyle: "short",
  }).format(d);
}
