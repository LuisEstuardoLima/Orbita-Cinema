"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { bloquearAsientosSeleccion, consultarOcupacion, liberarBloqueo } from "./actions";
import { SiteHeader } from "@/components/cinema/SiteHeader";
import { SiteFooter } from "@/components/cinema/SiteFooter";
import { FunctionHeader } from "@/components/cinema/FunctionHeader";
import { claveColumnaAsiento, crearEtiquetasVisibles } from "@/lib/asientos";
import {
  etiquetaFuncion,
  fechaCortaFuncion,
  quetzales,
  salaFuncion,
  type ResumenCompra,
} from "@/lib/compra";
import type { AsientoRow } from "@/lib/db-types";
import { toHref } from "@/lib/search-params";

type Props = {
  slug: string;
  hall: string;
  time: string;
  format: string;
  adulto: number;
  tercera: number;
  ninos: number;
  /** SCRUM-122: función y resumen calculados en el servidor (`calcularResumenCompra`). */
  idFuncion: number;
  resumen: ResumenCompra | null;
  errorResumen: string | null;
  /** SCRUM-118: distribución física de asientos de la sala (desde BD). */
  distribucion: AsientoRow[];
  /** SCRUM-118: ids de asientos ya ocupados (bloqueados/reservados) para esta función. */
  asientosOcupados: number[];
  /** SCRUM-119: true cuando el cliente vuelve porque su bloqueo de 5 minutos venció. */
  avisoVencido?: boolean;
};

/** SCRUM-120: cada cuántos ms se consulta la ocupación mientras la pestaña está visible. */
const INTERVALO_OCUPACION_MS = 3000;

/** Cuántos ms se muestra un aviso (compra vencida / asientos tomados) antes de ocultarse solo. */
const DURACION_AVISO_MS = 9000;

const SEAT_SIZE = "h-8 w-8";
const SEAT_RADIUS = "rounded-[4px]";

export function AsientosClient(search: Props) {
  const {
    slug,
    hall,
    time,
    format,
    adulto,
    tercera,
    ninos,
    idFuncion,
    resumen,
    errorResumen,
    distribucion,
    asientosOcupados,
    avisoVencido = false,
  } = search;

  const router = useRouter();

  const totalEntradas = adulto + tercera + ninos;

  // Agrupa asientos por fila para dibujar el mapa.
  const asientosPorFila = new Map<string, AsientoRow[]>();

  for (const asiento of distribucion) {
    const lista = asientosPorFila.get(asiento.fila) ?? [];
    lista.push(asiento);
    asientosPorFila.set(asiento.fila, lista);
  }

  const filasOrdenadas = Array.from(asientosPorFila.keys()).sort();

  const etiquetasVisibles = crearEtiquetasVisibles(distribucion);
  const etiquetaVisible = (fila: string, numeroColumna: number) =>
    etiquetasVisibles.get(claveColumnaAsiento(fila, numeroColumna)) ??
    `${fila}${numeroColumna}`;

  // SCRUM-120: la ocupación arranca con lo que trajo el servidor y se mantiene al día sola.
  const [ocupadosIds, setOcupadosIds] = useState<number[]>(asientosOcupados);
  const setOcupados = new Set(ocupadosIds);

  const [selected, setSelected] = useState<string[]>([]);
  const [avisoTomados, setAvisoTomados] = useState<string[]>([]);
  const [limitReached, setLimitReached] = useState(false);
  const [bloqueando, setBloqueando] = useState(false);
  const [errorBloqueo, setErrorBloqueo] = useState<string | null>(null);

  // El aviso de compra vencida nace visible (viene de /pago) y se oculta solo pasados
  // DURACION_AVISO_MS, para no dejarlo pegado en pantalla.
  const [mostrarVencido, setMostrarVencido] = useState(avisoVencido);

  // SCRUM-119 (criterio 6): si el cliente regresó aquí desde el pago, sus asientos bloqueados
  // se liberan de inmediato. La página ya no los cuenta como ocupados para él.
  useEffect(() => {
    void liberarBloqueo();
  }, []);

  // Si el servidor entrega otra ocupación (p. ej. tras router.refresh), se adopta.
  useEffect(() => {
    setOcupadosIds(asientosOcupados);
  }, [asientosOcupados]);

  // SCRUM-120 (criterios 1 y 2): consulta la ocupación cada pocos segundos y al volver a la
  // pestaña. Un asiento que otro cliente bloquea o reserva pasa a "Ocupado"; uno cuyo bloqueo
  // venció vuelve a verse libre. Sin recargar la página.
  const consultando = useRef(false);

  const actualizarOcupacion = useCallback(async () => {
    if (consultando.current || idFuncion <= 0) return;

    consultando.current = true;

    try {
      const ids = await consultarOcupacion(idFuncion);

      if (ids) {
        setOcupadosIds((prev) => {
          const igual =
            prev.length === ids.length &&
            prev.every((id) => ids.includes(id));

          return igual ? prev : ids;
        });
      }
    } finally {
      consultando.current = false;
    }
  }, [idFuncion]);

  useEffect(() => {
    if (idFuncion <= 0) return;

    const alVolver = () => {
      if (!document.hidden) {
        void actualizarOcupacion();
      }
    };

    const timer = window.setInterval(
      alVolver,
      INTERVALO_OCUPACION_MS,
    );

    document.addEventListener("visibilitychange", alVolver);
    window.addEventListener("focus", alVolver);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", alVolver);
      window.removeEventListener("focus", alVolver);
    };
  }, [idFuncion, actualizarOcupacion]);

  // Si otro cliente tomó un asiento que yo tenía elegido, se quita de mi selección y se avisa.
  useEffect(() => {
    const ocupados = new Set(ocupadosIds);

    const tomados = selected.filter((key) => {
      const m = /^([A-Za-z]+)(\d+)$/.exec(key);

      const id = m
        ? distribucion.find(
            (a) =>
              a.fila === m[1] &&
              a.numero === Number(m[2]),
          )?.id
        : undefined;

      return id !== undefined && ocupados.has(id);
    });

    if (tomados.length === 0) return;

    setSelected((s) =>
      s.filter((key) => !tomados.includes(key)),
    );

    setLimitReached(false);
    setAvisoTomados(tomados);
  }, [ocupadosIds, selected, distribucion]);

  // Los avisos no deben quedarse en pantalla todo el tiempo.
  useEffect(() => {
    if (!avisoVencido) return;

    const id = window.setTimeout(
      () => setMostrarVencido(false),
      DURACION_AVISO_MS,
    );

    return () => window.clearTimeout(id);
  }, [avisoVencido]);

  useEffect(() => {
    if (avisoTomados.length === 0) return;

    const id = window.setTimeout(
      () => setAvisoTomados([]),
      DURACION_AVISO_MS,
    );

    return () => window.clearTimeout(id);
  }, [avisoTomados]);

  const esOcupado = (fila: string, numero: number) =>
    setOcupados.has(
      distribucion.find(
        (a) =>
          a.fila === fila &&
          a.numero === numero,
      )?.id ?? -1,
    );

  const seatKey = (fila: string, numero: number) =>
    `${fila}${numero}`;

  const estaSeleccionado = (fila: string, numero: number) =>
    selected.includes(seatKey(fila, numero));

  const toggle = (fila: string, numero: number) => {
    if (esOcupado(fila, numero)) return;

    setAvisoTomados([]);

    const key = seatKey(fila, numero);

    setSelected((s) => {
      if (s.includes(key)) {
        setLimitReached(false);
        return s.filter((x) => x !== key);
      }

      if (s.length >= totalEntradas) {
        setLimitReached(true);
        return s;
      }

      return [...s, key];
    });
  };

  const cantidadSeleccionada = selected.length;

  const seleccionCompleta =
    cantidadSeleccionada === totalEntradas &&
    totalEntradas > 0;

  // Ordena asientos por fila ascendente y luego por número.
  const ordenarAsientos = (asientos: string[]): string[] => {
    return [...asientos].sort((a, b) => {
      const matchA = /^([A-Za-z]+)(\d+)$/.exec(a);
      const matchB = /^([A-Za-z]+)(\d+)$/.exec(b);

      if (!matchA || !matchB) {
        return a.localeCompare(b);
      }

      const [, filaA = "", numA = "0"] = matchA;
      const [, filaB = "", numB = "0"] = matchB;

      const cmpFila = filaA
        .toLowerCase()
        .localeCompare(filaB.toLowerCase());

      if (cmpFila !== 0) return cmpFila;

      return Number(numA) - Number(numB);
    });
  };

  // Para "Cancelar": volver a /entradas con la misma función y cantidades.
  const volverAEntradas = toHref("/entradas", {
    funcion: idFuncion,
    adulto,
    tercera,
    ninos,
  });

  // Para "Continuar": llevar los asientos seleccionados al siguiente paso.
  const continuarHref = seleccionCompleta
    ? toHref("/pago", {
        slug,
        hall,
        time,
        format,
        seats: ordenarAsientos(selected)
          .map((key) => {
            const match = /^([A-Za-z]+)(\d+)$/.exec(key);
            return match
              ? etiquetaVisible(match[1]!, Number(match[2]))
              : key;
          })
          .join(","),
        total: resumen?.total ?? 0,
        funcion: idFuncion,
        adulto,
        tercera,
        ninos,
      })
    : null;

  // SCRUM-119: bloquea los asientos antes de pasar al pago.
  const continuar = async () => {
    if (!continuarHref || bloqueando) return;

    const etiquetasSeleccionadas = selected.map((key) => {
      const match = /^([A-Za-z]+)(\d+)$/.exec(key);
      return match
        ? etiquetasVisibles.get(
            claveColumnaAsiento(match[1]!, Number(match[2])),
          )
        : undefined;
    });
    if (etiquetasSeleccionadas.some((etiqueta) => !etiqueta)) {
      setErrorBloqueo("No se pudo identificar uno de los asientos seleccionados. Elige de nuevo.");
      return;
    }

    setBloqueando(true);
    setErrorBloqueo(null);

    const res = await bloquearAsientosSeleccion({
      idFuncion,
      cantidades: {
        adulto,
        tercera,
        ninos,
      },
      asientos: etiquetasSeleccionadas.filter(
        (etiqueta): etiqueta is string => Boolean(etiqueta),
      ),
    });

    if (!res.ok) {
      setErrorBloqueo(res.error);
      setBloqueando(false);

      void actualizarOcupacion();
      return;
    }

    router.push(continuarHref);
  };

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-[1400px] flex-1 px-6 py-10">
        <FunctionHeader
          title={
            resumen
              ? resumen.funcion.pelicula
              : "Función no disponible"
          }
          subtitle={
            resumen
              ? etiquetaFuncion(resumen.funcion)
              : "Vuelve a la cartelera para elegir otra función."
          }
        />

        {mostrarVencido && (
          <p
            role="alert"
            className="mb-6 rounded-md border border-destructive bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            El tiempo para completar tu compra venció y tus asientos fueron liberados.
            Elige tus asientos de nuevo.
          </p>
        )}

        {avisoTomados.length > 0 && (
          <p
            role="alert"
            className="mb-6 rounded-md border border-destructive bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {avisoTomados.length === 1
              ? `El asiento ${avisoTomados[0]} ya se encuentra reservado. Selecciona otro para continuar.`
              : `Los asientos ${avisoTomados.join(", ")} ya se encuentran reservados. Selecciona otros para continuar.`}
          </p>
        )}

        <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
          <section className="card-surface p-6">
            <div className="mx-auto mb-8 max-w-2xl">
              <div className="rounded-t-[50%] border-t-4 border-primary bg-linear-to-b from-primary/25 to-transparent py-4 text-center">
                <span className="font-display text-2xl tracking-[0.3em] text-secondary">
                  PANTALLA
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <div className="mx-auto w-fit">
                {filasOrdenadas.map((fila) => (
                  <div
                    key={fila}
                    className="mb-1.5 flex items-center gap-2"
                  >
                    <span className="w-4 text-xs text-muted-foreground">
                      {fila}
                    </span>

                    <div className="flex gap-1.5">
                      {asientosPorFila.get(fila)?.map((asiento) => {
                        const ocupado = esOcupado(
                          asiento.fila,
                          asiento.numero,
                        );

                        const seleccionado = estaSeleccionado(
                          asiento.fila,
                          asiento.numero,
                        );

                        const clave = seatKey(
                          asiento.fila,
                          asiento.numero,
                        );

                        if (asiento.estado !== "normal") {
                          return (
                            <button
                              key={clave}
                              type="button"
                              disabled
                              aria-label={`${etiquetaVisible(asiento.fila, asiento.numero)} — ${asiento.estado}`}
                              className={`flex ${SEAT_SIZE} select-none items-center justify-center ${SEAT_RADIUS} border text-[11px] font-medium transition-all cursor-not-allowed opacity-70 ${
                                asiento.estado === "pasillo"
                                  ? "border-dashed border-border bg-transparent text-muted-foreground/50"
                                  : "border-transparent bg-muted-foreground/60 text-background"
                              }`}
                            >
                              {asiento.estado === "pasillo"
                                ? "·"
                                : "×"}
                            </button>
                          );
                        }

                        const isReserved = ocupado;
                        const isSelected = seleccionado;

                        return (
                          <button
                            key={clave}
                            type="button"
                            onClick={() =>
                              toggle(
                                asiento.fila,
                                asiento.numero,
                              )
                            }
                            aria-label={
                              isReserved
                                ? `${etiquetaVisible(asiento.fila, asiento.numero)} — Ocupado`
                                : `${etiquetaVisible(asiento.fila, asiento.numero)} — ${
                                    isSelected
                                      ? "Seleccionado"
                                      : "Disponible"
                                  }`
                            }
                            className={`flex ${SEAT_SIZE} select-none items-center justify-center ${SEAT_RADIUS} border text-[11px] font-medium transition-all ${
                              isReserved
                                ? "border-transparent bg-muted-foreground/60 text-background cursor-not-allowed opacity-70"
                                : isSelected
                                  ? "border-primary bg-primary text-primary hover:border-primary hover:bg-primary/90 cursor-pointer"
                                  : "border-primary/50 bg-primary/10 text-primary hover:border-primary hover:bg-primary/20 cursor-pointer"
                            }`}
                          >
                            {etiquetaVisible(asiento.fila, asiento.numero).replace(asiento.fila, "")}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <aside className="card-surface h-fit p-6">
            <h2 className="text-3xl tracking-wide">
              Reserva:
            </h2>

            <ul className="mt-4 space-y-3 text-sm">
              <li className="flex items-center gap-3">
                <span className="h-5 w-5 rounded-[4px] border border-primary/50 bg-primary/10" />
                Disponible
              </li>

              <li className="flex items-center gap-3">
                <span className="h-5 w-5 rounded-[4px] border border-primary bg-primary" />
                Seleccionado
              </li>

              <li className="flex items-center gap-3">
                <span className="h-5 w-5 rounded-[4px] bg-muted-foreground/60" />
                Reservado
              </li>
            </ul>

            <div className="my-5 h-px bg-border" />

            <p className="text-lg">
              Selección:{" "}
              <span className="font-semibold text-primary">
                {selected.length
                  ? ordenarAsientos(selected)
                      .map((key) => {
                        const match = /^([A-Za-z]+)(\d+)$/.exec(key);
                        return match
                          ? etiquetaVisible(match[1]!, Number(match[2]))
                          : key;
                      })
                      .join(", ")
                  : "—"}
              </span>
            </p>

            {limitReached && (
              <p className="mt-2 text-sm text-primary">
                Has alcanzado el límite máximo de {totalEntradas} asientos.
              </p>
            )}

            <div className="my-5 h-px bg-border" />

            <h3 className="mb-3 text-xl tracking-wide">
              Confirmación
            </h3>

            {resumen ? (
              <dl className="space-y-2 rounded-lg bg-surface-2 p-4 text-sm">
                <Row
                  label="Película"
                  value={resumen.funcion.pelicula}
                  multilinea
                />

                <Row
                  label="Horario"
                  value={`${fechaCortaFuncion(resumen.funcion.fecha)} · ${resumen.funcion.hora} Hrs.`}
                />

                <Row
                  label="Sala"
                  value={salaFuncion(resumen.funcion)}
                />

                <div className="mt-2 space-y-2 border-t border-border pt-2">
                  {resumen.lineas
                    .filter((l) => l.cantidad > 0)
                    .map((l) => (
                      <Row
                        key={l.tipo}
                        label={`${l.cantidad} × ${l.nombre}`}
                        value={quetzales(l.importe)}
                        plain
                      />
                    ))}
                </div>

                <div className="mt-2 space-y-2 border-t border-border pt-2">
                  <Row
                    label="Subtotal"
                    value={quetzales(resumen.subtotal)}
                  />

                  <Row
                    label="Recargo"
                    value={quetzales(resumen.recargo)}
                  />
                </div>

                <div className="mt-2 border-t border-border pt-2">
                  <Row
                    label="Total"
                    value={quetzales(resumen.total)}
                    highlight
                  />
                </div>
              </dl>
            ) : (
              <div className="rounded-lg bg-surface-2 p-4 text-sm">
                <p
                  role="alert"
                  className="text-destructive"
                >
                  {errorResumen}
                </p>

                <Link
                  href="/"
                  className="mt-3 inline-block font-semibold text-primary hover:underline"
                >
                  Volver a la cartelera
                </Link>
              </div>
            )}

            {errorBloqueo && (
              <p
                role="alert"
                className="mt-4 text-sm text-destructive"
              >
                {errorBloqueo}
              </p>
            )}

            <div className="mt-6 flex gap-3">
              <Link
                href={volverAEntradas}
                className="btn-ghost flex-1"
              >
                Cancelar
              </Link>

              {seleccionCompleta && continuarHref ? (
                <button
                  type="button"
                  onClick={continuar}
                  disabled={bloqueando}
                  className="btn-primary flex-1"
                >
                  {bloqueando
                    ? "Bloqueando asientos..."
                    : "Continuar"}
                </button>
              ) : (
                <span
                  aria-disabled="true"
                  className="btn-primary pointer-events-none flex-1 opacity-50"
                >
                  Continuar
                </span>
              )}
            </div>
          </aside>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}

function Row({
  label,
  value,
  highlight,
  plain,
  multilinea,
}: {
  label: string;
  value: string;
  highlight?: boolean;
  /** Sin ":" tras la etiqueta (líneas del desglose, p. ej. "2 × Adulto"). */
  plain?: boolean;
  /** Valor que puede ocupar varias líneas (p. ej. el título de la película). */
  multilinea?: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between${multilinea ? " gap-3" : ""}`}
    >
      <dt
        className={`text-muted-foreground${
          multilinea
            ? " shrink-0 whitespace-nowrap"
            : ""
        }`}
      >
        {label}
        {plain ? "" : ":"}
      </dt>

      <dd
        className={`${
          highlight
            ? "text-lg font-bold text-primary"
            : "font-medium"
        }${multilinea ? " text-right" : ""}`}
      >
        {value}
      </dd>
    </div>
  );
}