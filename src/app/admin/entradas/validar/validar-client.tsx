"use client";

import { useCallback, useRef, useState } from "react";
import { CheckCircle2, QrCode, Search, XCircle } from "lucide-react";
import { EscanerQr } from "@/components/admin/EscanerQr";
import { validarEntrada } from "../actions";
import { numeroReserva, quetzales } from "@/lib/compra";
import type { DatosEntrada, ModoBusqueda, ResultadoValidacion } from "@/lib/validacion";

type Props = {
  hoy: string;
};

const MODOS_MANUALES: { id: ModoBusqueda; etiqueta: string; ayuda: string; placeholder: string }[] =
  [
    {
      id: "entrada",
      etiqueta: "ID de entrada",
      ayuda: "Número de la entrada (boleto).",
      placeholder: "Ej. 245",
    },
    {
      id: "reserva",
      etiqueta: "Número de reserva",
      ayuda: "El que ve el cliente en su confirmación (ORB-000123) o solo el número.",
      placeholder: "Ej. ORB-001380",
    },
  ];

export function ValidarEntradasClient({ hoy }: Props) {
  const [pestana, setPestana] = useState<"escaner" | "manual">("escaner");
  const [modo, setModo] = useState<ModoBusqueda>("entrada");
  const [valor, setValor] = useState("");
  const [procesando, setProcesando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoValidacion | null>(null);
  const enCurso = useRef(false); // evita doble envío (doble clic / dos lecturas seguidas)

  // Paso 1 (consulta): entrada encontrada y válida, pendiente de que se pulse "Validar".
  const [consulta, setConsulta] = useState<DatosEntrada | null>(null);

  const falloGenerico: ResultadoValidacion = {
    ok: false,
    motivo: "error",
    mensaje: "No se pudo completar la validación. Intenta de nuevo; la reserva no fue modificada.",
  };

  // Paso 1: solo CONSULTA (no modifica nada). Muestra los datos y el botón para validar.
  const buscar = useCallback(async (m: ModoBusqueda, v: string) => {
    if (enCurso.current) return;
    enCurso.current = true;
    setProcesando(true);
    try {
      const r = await validarEntrada({ modo: m, valor: v, confirmar: false });
      if (r.ok) setConsulta(r.datos);
      else setResultado(r);
    } catch {
      setResultado(falloGenerico);
    } finally {
      enCurso.current = false;
      setProcesando(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Paso 2: el botón. Marca la reserva como utilizada (atómico en la base de datos).
  const confirmar = async () => {
    if (!consulta || enCurso.current) return;
    enCurso.current = true;
    setProcesando(true);
    try {
      const r = await validarEntrada({
        modo: "reserva",
        valor: String(consulta.idCompra),
        confirmar: true,
      });
      setConsulta(null);
      setResultado(r);
    } catch {
      setResultado(falloGenerico);
      setConsulta(null);
    } finally {
      enCurso.current = false;
      setProcesando(false);
    }
  };

  const alLeerQr = useCallback((texto: string) => void buscar("qr", texto), [buscar]);

  const nueva = () => {
    setResultado(null);
    setConsulta(null);
    setValor("");
  };

  const modoManual = MODOS_MANUALES.find((x) => x.id === modo) ?? MODOS_MANUALES[0]!;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl tracking-wide">Validación de entradas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Escanea el código QR del boleto o busca la entrada o reserva manualmente. Primero se
          muestran los datos de la reserva y, al pulsar «Validar entrada», se registra como
          utilizada la reserva completa.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <section className="card-surface p-6">
          <div
            role="tablist"
            aria-label="Forma de validar"
            className="flex gap-2 border-b border-border"
          >
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
              <EscanerQr
                activo={resultado === null && consulta === null && !procesando}
                onCodigo={alLeerQr}
              />
            ) : (
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  void buscar(modo, valor);
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
                <button
                  type="submit"
                  disabled={procesando || valor.trim() === ""}
                  className="btn-primary"
                >
                  {procesando ? "Buscando..." : "Buscar entrada"}
                </button>
              </form>
            )}
          </div>
        </section>

        <aside className="card-surface h-fit p-6" aria-live="polite">
          <h2 className="text-2xl tracking-wide">Resultado</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            La función se detecta automáticamente a partir de la entrada.
          </p>
          {procesando && <p className="mt-6 text-sm text-muted-foreground">Procesando...</p>}

          {!procesando && resultado === null && consulta === null && (
            <p className="mt-6 text-sm text-muted-foreground">
              Aún no hay validaciones. Escanea un QR o busca una entrada para ver los datos.
            </p>
          )}

          {!procesando && consulta && (
            <div role="status" className="mt-6 rounded-lg border border-primary p-4">
              <p className="flex items-center gap-2 text-lg font-semibold text-primary">
                <CheckCircle2 className="h-6 w-6" />
                Entrada encontrada
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Revisa los datos. La entrada todavía NO está marcada como usada.
              </p>
              {consulta.fechaFuncion && consulta.fechaFuncion !== hoy && (
                <p className="mt-3 rounded-md border border-amber-500 bg-amber-500/10 p-2 text-xs text-amber-500">
                  Atención: esta entrada es para una función de otro día ({consulta.fechaFuncion}).
                </p>
              )}
              <DatosReserva d={consulta} hoy={hoy} />
              <button
                type="button"
                onClick={() => void confirmar()}
                className="btn-primary mt-4 w-full"
              >
                Validar entrada y marcar como usada
              </button>
              <button type="button" onClick={nueva} className="btn-ghost mt-2 w-full">
                Cancelar
              </button>
            </div>
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
                {resultado.ok ? (
                  <CheckCircle2 className="h-6 w-6" />
                ) : (
                  <XCircle className="h-6 w-6" />
                )}
                {resultado.ok ? "Entrada validada: ingreso permitido" : "Validación rechazada"}
              </p>
              {!resultado.ok && <p className="mt-2 text-sm">{resultado.mensaje}</p>}

              {resultado.datos && (
                <DatosReserva
                  d={resultado.datos}
                  hoy={hoy}
                  mostrarUso={!resultado.ok && resultado.motivo === "ya_utilizada"}
                />
              )}

              <button type="button" onClick={nueva} className="btn-ghost mt-4 w-full">
                {pestana === "escaner" ? "Escanear siguiente" : "Nueva búsqueda"}
              </button>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}

function DatosReserva({
  d,
  hoy,
  mostrarUso,
}: {
  d: DatosEntrada;
  hoy: string;
  mostrarUso?: boolean;
}) {
  return (
    <dl className="mt-4 space-y-1.5 text-sm">
      <Fila etiqueta="ID de compra" valor={numeroReserva(d.idCompra)} destacado />
      {d.idEntrada != null && <Fila etiqueta="ID de entrada" valor={`#${d.idEntrada}`} />}
      <Fila etiqueta="Comprador" valor={d.comprador} />
      {d.pelicula && <Fila etiqueta="Película" valor={d.pelicula} />}
      {d.sala && <Fila etiqueta="Sala" valor={d.sala} />}
      {d.fechaFuncion && (
        <Fila
          etiqueta="Función"
          valor={`${d.fechaFuncion === hoy ? "Hoy" : d.fechaFuncion} · ${d.horaFuncion ?? ""}`.trim()}
        />
      )}
      <Fila etiqueta="Asientos" valor={d.asientos.length ? d.asientos.join(", ") : "—"} />
      <Fila etiqueta="Total" valor={quetzales(d.total)} />
      {mostrarUso && d.fechaUso && (
        <Fila etiqueta="Validada el" valor={formatoFechaHora(d.fechaUso)} />
      )}
    </dl>
  );
}

function Fila({
  etiqueta,
  valor,
  destacado,
}: {
  etiqueta: string;
  valor: string;
  destacado?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-muted-foreground">{etiqueta}:</dt>
      <dd className={`text-right ${destacado ? "font-bold text-primary" : "font-medium"}`}>
        {valor}
      </dd>
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
