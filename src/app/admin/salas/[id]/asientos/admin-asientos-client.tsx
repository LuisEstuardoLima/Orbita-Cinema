"use client";

/**
 * Configurador de asientos de una sala (SCRUM-110) — parte del navegador.
 *
 * El admin indica cuántas filas y columnas tiene la sala; se dibuja la
 * cuadrícula con nomenclatura A1, A2, B1… Cada celda se recorre con clics:
 * normal -> pasillo -> deshabilitado -> normal. Los pasillos y
 * deshabilitados no cuentan como asientos disponibles.
 *
 * Si la sala tiene funciones activas (`bloqueada`), la cuadrícula es de solo
 * lectura: no se puede re-configurar para no invalidar una función futura.
 */

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import { ArrowLeft, Brush, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/cinema/Modal";
import type { AsientoRow } from "@/lib/db-types";
import type { SalaAdmin } from "@/lib/db/salas";
import { guardarDistribucionAsientos } from "../../actions";

type Estado = AsientoRow["estado"];

const MAX_FILAS = 12; // A..L
const MAX_COLUMNAS = 20;
/** Capacidad máxima por sala, sobre asientos DISPONIBLES (regla de negocio). */
const CAPACIDAD_MAXIMA = 200;

const letraFila = (indice: number) => String.fromCharCode(65 + indice);

/** Orden de los estados, tal como se listan en la leyenda/pincel. */
const CICLO: Estado[] = ["normal", "pasillo", "deshabilitado"];

/**
 * Colores por estado. Los "Disponible" usan el anaranjado de la marca
 * (border-primary / bg-primary) para mantener la identidad visual; pasillo y
 * deshabilitado se diferencian con grises sutiles. Tamaño y radio (h-7 w-7,
 * rounded-[4px], border) coherentes con el mapa del cliente.
 */
const claseEstado: Record<Estado, string> = {
  // Disponible: identidad de marca sin saturar — borde naranja sutil, número
  // naranja y un fondo con un ligero matiz naranja muy tenue.
  normal:
    "border-primary/50 bg-primary/10 text-primary hover:border-primary hover:bg-primary/20 cursor-pointer",
  // Pasillo: recuadro punteado y transparente, sin número (se dibuja "·").
  pasillo:
    "border-dashed border-border bg-transparent text-muted-foreground/50 cursor-pointer",
  // Deshabilitado: gris claro sólido con el glifo "×" en texto oscuro.
  deshabilitado:
    "border-transparent bg-muted-foreground/60 text-background cursor-pointer",
};

/** Glifo mostrado dentro de la cajita cuando no es un asiento disponible. */
const glifoEstado: Record<Estado, string> = {
  normal: "", // el número correlativo se calcula por fila
  pasillo: "·",
  deshabilitado: "×",
};

const etiquetaLeyenda: Record<Estado, string> = {
  normal: "Disponible",
  pasillo: "Pasillo",
  deshabilitado: "Deshabilitado",
};

export function AdminAsientosClient({
  sala,
  distribucion,
  bloqueada: bloqueadaPorFunciones,
  soloLectura = false,
}: {
  sala: SalaAdmin;
  distribucion: AsientoRow[];
  bloqueada: boolean;
  /** Colaborador (SCRUM-116): ve el plano de asientos pero no puede modificarlo ni guardarlo. */
  soloLectura?: boolean;
}) {
  // La cuadrícula ya sabe quedar en solo lectura (`bloqueada`); el Colaborador usa el mismo modo.
  const bloqueada = bloqueadaPorFunciones || soloLectura;
  // Dimensiones iniciales: si ya hay plano guardado, se derivan de él;
  // si no, se parte de una cuadrícula de ejemplo.
  const inicial = useMemo(() => {
    if (distribucion.length > 0) {
      const filas = new Set(distribucion.map((a) => a.fila));
      const columnas = Math.max(...distribucion.map((a) => a.numero));
      return { filas: filas.size, columnas };
    }
    return { filas: 8, columnas: 12 };
  }, [distribucion]);

  const [filas, setFilas] = useState(inicial.filas);
  const [columnas, setColumnas] = useState(inicial.columnas);

  // Estado de cada celda indexado por `${letra}-${numero}`.
  const [celdas, setCeldas] = useState<Record<string, Estado>>(() => {
    const mapa: Record<string, Estado> = {};
    for (const a of distribucion) mapa[`${a.fila}-${a.numero}`] = a.estado;
    return mapa;
  });

  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  // ¿Hay cambios sin guardar? Se activa al pintar/cambiar dimensiones y se
  // limpia al guardar. Sirve para avisar antes de salir de la pantalla.
  const [sucio, setSucio] = useState(false);
  // Controla el modal "cambios sin guardar" al intentar volver a /admin/salas.
  const [confirmarSalida, setConfirmarSalida] = useState(false);

  const router = useRouter();

  // Estado "activo" del pincel: lo que se aplica al hacer clic o arrastrar.
  const [pincelActivo, setPincelActivo] = useState<Estado>("normal");

  // Arrastre para pintar: `pintando` indica que el clic está presionado y
  // `ultimaPintada` evita repintar la misma celda en cada onMouseEnter.
  const pintando = useRef(false);
  const ultimaPintada = useRef<string | null>(null);

  // Al soltar el clic en cualquier parte de la ventana, termina el arrastre.
  useEffect(() => {
    const soltar = () => {
      pintando.current = false;
      ultimaPintada.current = null;
    };
    window.addEventListener("mouseup", soltar);
    return () => window.removeEventListener("mouseup", soltar);
  }, []);

  // Aviso nativo del navegador si se recarga o cierra la pestaña con cambios
  // sin guardar.
  useEffect(() => {
    if (!sucio) return;
    const avisar = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", avisar);
    return () => window.removeEventListener("beforeunload", avisar);
  }, [sucio]);

  const estadoDe = (letra: string, numero: number): Estado =>
    celdas[`${letra}-${numero}`] ?? "normal";

  // Conteo en vivo de asientos disponibles ("normal").
  const disponibles = useMemo(() => {
    let total = 0;
    for (let f = 0; f < filas; f++) {
      const letra = letraFila(f);
      for (let n = 1; n <= columnas; n++) {
        if ((celdas[`${letra}-${n}`] ?? "normal") === "normal") total++;
      }
    }
    return total;
  }, [celdas, filas, columnas]);

  /**
   * Al cambiar filas/columnas se regenera la cuadrícula conservando el
   * estado de las celdas que sigan existiendo. Las que quedan fuera del
   * nuevo tamaño simplemente se descartan.
   */
  const aplicarDimensiones = (nuevasFilas: number, nuevasColumnas: number) => {
    const nuevas: Record<string, Estado> = {};
    for (let f = 0; f < nuevasFilas; f++) {
      const letra = letraFila(f);
      for (let n = 1; n <= nuevasColumnas; n++) {
        nuevas[`${letra}-${n}`] = estadoDe(letra, n);
      }
    }
    setCeldas(nuevas);
  };

  const cambiarFilas = (valor: number) => {
    if (!Number.isInteger(valor) || valor < 1 || valor > MAX_FILAS) return;
    setFilas(valor);
    aplicarDimensiones(valor, columnas);
    setSucio(true);
  };

  const cambiarColumnas = (valor: number) => {
    if (!Number.isInteger(valor) || valor < 1 || valor > MAX_COLUMNAS) return;
    setColumnas(valor);
    aplicarDimensiones(filas, valor);
    setSucio(true);
  };

  /**
   * Aplica el estado del pincel a una celda. Si `forzar` es false (mouseenter
   * durante arrastre), solo pinta mientras el clic esté presionado y evita
   * repetir la misma celda.
   */
  const pintarCelda = (
    letra: string,
    numero: number,
    opciones: { forzar?: boolean } = {},
  ) => {
    if (bloqueada) return;
    const clave = `${letra}-${numero}`;

    if (!opciones.forzar) {
      if (!pintando.current) return;
      if (ultimaPintada.current === clave) return;
    }
    ultimaPintada.current = clave;

    setCeldas((prev) => {
      const actualizado: Record<string, Estado> = { ...prev };
      actualizado[clave] = pincelActivo;
      return actualizado;
    });
    setSucio(true);
  };

  /** Al presionar una celda se inicia el arrastre y se pinta esa celda. */
  const empezarPintado = (letra: string, numero: number) => {
    if (bloqueada) return;
    pintando.current = true;
    pintarCelda(letra, numero, { forzar: true });
  };

  /** Aplica el pincel a toda una fila (Opción A). */
  const pintarFila = (letra: string) => {
    if (bloqueada) return;
    setCeldas((prev) => {
      const actualizado: Record<string, Estado> = { ...prev };
      for (let n = 1; n <= columnas; n++) actualizado[`${letra}-${n}`] = pincelActivo;
      return actualizado;
    });
    setSucio(true);
  };

  /** Aplica el pincel a toda una columna (Opción A). */
  const pintarColumna = (numero: number) => {
    if (bloqueada) return;
    setCeldas((prev) => {
      const actualizado: Record<string, Estado> = { ...prev };
      for (let f = 0; f < filas; f++) {
        actualizado[`${letraFila(f)}-${numero}`] = pincelActivo;
      }
      return actualizado;
    });
    setSucio(true);
  };

  const guardar = () => {
    setError(null);
    setMensaje(null);

    // Regla de negocio: el límite de 200 es sobre asientos DISPONIBLES, no
    // sobre el total de la matriz (pasillos y deshabilitados no cuentan).
    if (disponibles > CAPACIDAD_MAXIMA) {
      setError(
        `La sala no permite más de ${CAPACIDAD_MAXIMA} asientos disponibles (hay ${disponibles}). Marca algunos como pasillo o deshabilitado.`,
      );
      return;
    }

    startTransition(async () => {
      const res = await guardarDistribucionAsientos({
        idSala: sala.id,
        filas,
        columnas,
        celdas,
      });

      if (res.ok) {
        setSucio(false);
        setMensaje(
          `Distribución guardada. La sala ahora tiene ${disponibles} asientos disponibles.`,
        );
      } else {
        setError(res.error);
      }
    });
  };

  return (
    <section className="card-surface p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl tracking-wide">
            Configurar asientos — {sala.nombre}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Define la cuadrícula y marca los pasillos y asientos
            deshabilitados. La capacidad se calcula con los asientos
            disponibles.
          </p>
        </div>

        <span className="rounded-md bg-primary/15 px-2 py-1 text-xs font-bold text-primary">
          {sala.tipo || "—"}
        </span>
      </div>

      <div className="mt-4">
        <button
          type="button"
          className="btn-ghost"
          onClick={() =>
            sucio ? setConfirmarSalida(true) : router.push("/admin/salas")
          }
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a salas
        </button>
      </div>

      {/* Aviso cuando la sala está bloqueada por tener funciones activas */}
      {soloLectura ? (
        <p
          role="note"
          className="mt-4 rounded-md border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground"
        >
          Modo consulta: tu rol (Colaborador) puede ver la distribución de asientos, pero no
          modificarla.
        </p>
      ) : (
        bloqueadaPorFunciones && (
          <p
            role="alert"
            className="mt-4 rounded-md border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground"
          >
            Esta sala tiene funciones activas, por lo que su distribución está
            en solo lectura. Cancelar o desactivar esas funciones antes de
            modificar los asientos.
          </p>
        )
      )}

      {/* Controles de dimensiones */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:max-w-md">
        <div>
          <label className="label" htmlFor="filas">
            Número de filas
          </label>
          <input
            id="filas"
            type="number"
            inputMode="numeric"
            className="field"
            min={1}
            max={MAX_FILAS}
            step={1}
            value={filas}
            disabled={bloqueada}
            onChange={(e) => cambiarFilas(Number(e.target.value))}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Filas de la A a la {letraFila(MAX_FILAS - 1)} (máx. {MAX_FILAS}).
          </p>
        </div>

        <div>
          <label className="label" htmlFor="columnas">
            Asientos por fila
          </label>
          <input
            id="columnas"
            type="number"
            inputMode="numeric"
            className="field"
            min={1}
            max={MAX_COLUMNAS}
            step={1}
            value={columnas}
            disabled={bloqueada}
            onChange={(e) => cambiarColumnas(Number(e.target.value))}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Columnas por fila (máx. {MAX_COLUMNAS}).
          </p>
        </div>
      </div>

      {/* Pincel / leyenda: elegir el estado activo para pintar */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Brush className="h-4 w-4" />
          Pincel:
        </span>

        {CICLO.map((estado) => {
          const activo = pincelActivo === estado;
          return (
            <button
              key={estado}
              type="button"
              onClick={() => setPincelActivo(estado)}
              aria-pressed={activo}
              className={`flex items-center gap-2 rounded-md border px-2.5 py-1 text-xs transition-colors ${
                activo
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border text-muted-foreground hover:border-primary/60"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 rounded-[3px] border ${claseEstado[estado].replace(" cursor-pointer", "")}`}
              />
              {etiquetaLeyenda[estado]}
            </button>
          );
        })}

        <span className="text-xs text-muted-foreground">
          Haz clic o arrastra sobre los asientos para aplicar. También puedes
          pintar una fila o columna completa desde sus encabezados.
        </span>
      </div>

      {/* Cuadrícula */}
      <div className="mt-4 overflow-x-auto">
        <div className="mx-auto w-fit">
          {/* Pantalla */}
          <div className="mx-auto mb-8 max-w-2xl">
            <div className="rounded-t-[50%] border-t-4 border-primary bg-linear-to-b from-primary/25 to-transparent py-3 text-center">
              <span className="font-display text-lg tracking-[0.3em] text-secondary">
                PANTALLA
              </span>
            </div>
          </div>

          <div className="flex flex-col">
            {/* Encabezado de columnas (números) — clic pinta la columna completa */}
            <div className="mb-1.5 flex items-center gap-1.5">
              <span className="w-6" aria-hidden />
              <div className="flex gap-1.5">
                {Array.from({ length: columnas }).map((__, n) => {
                  const numero = n + 1;
                  return (
                    <button
                      key={numero}
                      type="button"
                      disabled={bloqueada}
                      onClick={() => pintarColumna(numero)}
                      title={`Pintar la columna ${numero} como "${etiquetaLeyenda[pincelActivo]}"`}
                      className={`flex h-8 w-8 items-center justify-center rounded-[4px] border border-transparent text-[11px] font-semibold transition-colors ${
                        bloqueada
                          ? "cursor-not-allowed text-muted-foreground/40"
                          : "cursor-pointer text-muted-foreground hover:border-primary hover:text-primary"
                      }`}
                    >
                      {numero}
                    </button>
                  );
                })}
              </div>
            </div>

            {Array.from({ length: filas }).map((_, f) => {
              const letra = letraFila(f);
              // Contador por fila: solo cuentan los asientos "normal", así la
              // numeración visible es correlativa (1, 2, 3…) e ignora
              // pasillos y deshabilitados.
              let contador = 0;
              return (
                <div key={letra} className="mb-1.5 flex items-center gap-1.5">
                  {/* Encabezado de fila (letra) — clic pinta la fila completa */}
                  <button
                    type="button"
                    disabled={bloqueada}
                    onClick={() => pintarFila(letra)}
                    title={`Pintar la fila ${letra} como "${etiquetaLeyenda[pincelActivo]}"`}
                    className={`flex h-8 w-6 items-center justify-center rounded-[4px] border border-transparent text-xs font-semibold transition-colors ${
                      bloqueada
                        ? "cursor-not-allowed text-muted-foreground/40"
                        : "cursor-pointer text-muted-foreground hover:border-primary hover:text-primary"
                    }`}
                  >
                    {letra}
                  </button>

                  <div className="flex gap-1.5">
                    {Array.from({ length: columnas }).map((__, n) => {
                      const numero = n + 1;
                      const estado = estadoDe(letra, numero);
                      const numeroVisible =
                        estado === "normal" ? ++contador : null;
                      return (
                        <button
                          key={numero}
                          type="button"
                          disabled={bloqueada}
                          onMouseDown={() => empezarPintado(letra, numero)}
                          onMouseEnter={() => pintarCelda(letra, numero)}
                          title={
                            estado === "normal"
                              ? `${letra}${numeroVisible} — ${etiquetaLeyenda[estado]}`
                              : `${letra}${numero} — ${etiquetaLeyenda[estado]}`
                          }
                          aria-label={`${letra}${numero}`}
                          className={`flex h-8 w-8 select-none items-center justify-center rounded-[4px] border text-[11px] font-medium transition-all ${
                            claseEstado[estado]
                          } ${
                            bloqueada ? "cursor-not-allowed opacity-70" : ""
                          }`}
                        >
                          {estado === "normal"
                            ? numeroVisible
                            : glifoEstado[estado]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Resumen + acciones */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm">
          Asientos disponibles:{" "}
          <span className="font-bold text-primary">{disponibles}</span> de{" "}
          {filas * columnas}
        </p>

        {!soloLectura && (
          <button
            type="button"
            className="btn-primary"
            onClick={guardar}
            disabled={pendiente || bloqueada}
          >
            <Save className="h-4 w-4" />
            {pendiente ? "Guardando..." : "Guardar distribución"}
          </button>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {mensaje && !error && (
        <p role="status" className="mt-3 text-sm text-primary">
          {mensaje}
        </p>
      )}

      {/* Confirmación al salir con cambios sin guardar */}
      <Modal
        open={confirmarSalida}
        title="Cambios sin guardar"
        onClose={() => setConfirmarSalida(false)}
        footer={
          <>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setConfirmarSalida(false)}
            >
              Seguir editando
            </button>
            <button
              type="button"
              className="btn-danger"
              onClick={() => router.push("/admin/salas")}
            >
              Salir sin guardar
            </button>
          </>
        }
      >
        <p className="text-sm text-muted-foreground">
          Tienes cambios en la distribución de asientos que no has guardado.
          Si sales ahora, se perderán. ¿Seguro que quieres volver a la lista de
          salas?
        </p>
      </Modal>
    </section>
  );
}

