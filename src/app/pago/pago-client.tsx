"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { CheckCircle2 } from "lucide-react";
import { SiteHeader } from "@/components/cinema/SiteHeader";
import { SiteFooter } from "@/components/cinema/SiteFooter";
import { FunctionHeader } from "@/components/cinema/FunctionHeader";
import { Modal } from "@/components/cinema/Modal";
import { buildFunctionLabel, getMovie } from "@/lib/cinema-data";
import { ContadorBloqueo } from "@/components/cinema/ContadorBloqueo";
import {
  datosInvitadoSchema,
  datosTarjetaSchema,
  METODOS_PAGO,
  numeroReserva,
  quetzales,
  type Cantidades,
  type DatosInvitado,
  type DatosTarjeta,
  type MetodoPago,
} from "@/lib/compra";
import { toHref } from "@/lib/search-params";
import { liberarBloqueo } from "@/app/asientos/actions";
import { procesarPago } from "./actions";

type Props = {
  slug: string;
  hall: string;
  time: string;
  format: string;
  seats: string;
  total: number;
  /** SCRUM-119: función, cantidades (para volver a /asientos) y tiempo que le queda al bloqueo. */
  idFuncion: number;
  cantidades: Cantidades;
  segundosRestantes: number;
  /**
   * Datos de la cuenta si hay sesión iniciada (CA5); null si no hay sesión,
   * en cuyo caso se muestra la elección entre iniciar sesión y continuar
   * como invitado (CA1). Los entrega /pago/page.tsx con getPerfilActual().
   */
  cuenta: {
    nombre: string;
    apellido: string;
    email: string;
    telefono: string;
  } | null;
};

export function PagoClient(search: Props) {
  const movie = getMovie(search.slug || "batman");
  const [done, setDone] = useState(false);
  const [factura, setFactura] = useState("C/F");
  const router = useRouter();
  const [ocupado, setOcupado] = useState(false);

  // Ticket INVITADO: con cuenta se entra directo al pago (CA5); sin cuenta se
  // elige entre login e invitado (CA1) y luego se capturan los datos (CA2).
  const [paso, setPaso] = useState<"eleccion" | "datos" | "pago">(
    search.cuenta ? "pago" : "eleccion",
  );

  const [datos, setDatos] = useState<DatosInvitado>({
    nombre: search.cuenta
      ? `${search.cuenta.nombre} ${search.cuenta.apellido}`.trim()
      : "",
    correo: search.cuenta?.email ?? "",
    telefono: search.cuenta?.telefono ?? "",
  });

  const [errores, setErrores] = useState<
    Partial<Record<keyof DatosInvitado, string>>
  >({});

  // Ticket de pago: formulario de tarjeta con validación y resultado simulado.
  const [tarjeta, setTarjeta] = useState<DatosTarjeta>({
    nombre: "",
    numero: "",
    vencimiento: "",
    cvv: "",
  });

  const [erroresTarjeta, setErroresTarjeta] = useState<
    Partial<Record<keyof DatosTarjeta, string>>
  >({});

  const [errorPago, setErrorPago] = useState<string | null>(null);
  const [aprobado, setAprobado] = useState(false);
  const [metodo, setMetodo] = useState<MetodoPago>("tarjeta_credito");
  const [idReserva, setIdReserva] = useState<number | null>(null);
  const [correoEnviado, setCorreoEnviado] = useState<boolean | null>(null);

  // Para que "Iniciar sesión" vuelva a ESTA compra con todos sus parámetros.
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hrefLogin = `/login?next=${encodeURIComponent(
    `${pathname}?${searchParams.toString()}`,
  )}`;

  // Vuelve a elegir asientos; con `vencido` muestra el aviso de que se agotó el tiempo.
  const hrefAsientos = (vencido: boolean) =>
    toHref("/asientos", {
      funcion: search.idFuncion,
      ...search.cantidades,
      ...(vencido ? { vencido: 1 } : {}),
    });

  // Criterio 6: regresar o cancelar libera los asientos de inmediato.
  const salir = async (destino: string) => {
    setOcupado(true);
    await liberarBloqueo();
    router.push(destino);
  };

  // CA3: valida con el mismo schema que usará el servidor al confirmar la
  // compra; con errores se muestran los mensajes y NO se avanza al pago.
  const continuarDatos = (e: FormEvent) => {
    e.preventDefault();

    const r = datosInvitadoSchema.safeParse(datos);

    if (!r.success) {
      const errs: Partial<Record<keyof DatosInvitado, string>> = {};

      for (const issue of r.error.issues) {
        const campo = issue.path[0] as keyof DatosInvitado;

        if (!errs[campo]) {
          errs[campo] = issue.message;
        }
      }

      setErrores(errs);
      return;
    }

    setErrores({});
    setDatos(r.data);
    setPaso("pago");
  };

  // CA2/CA3/CA4: valida la tarjeta en el navegador, llama a la pasarela
  // simulada y según el resultado muestra rechazo o confirmación.
  const pagar = async () => {
    if (ocupado || aprobado) return;

    if (
      !search.cuenta &&
      !datosInvitadoSchema.safeParse(datos).success
    ) {
      setPaso("datos");
      return;
    }

    const r = datosTarjetaSchema.safeParse(tarjeta);

    if (!r.success) {
      const errs: Partial<Record<keyof DatosTarjeta, string>> = {};

      for (const issue of r.error.issues) {
        const campo = issue.path[0] as keyof DatosTarjeta;

        if (!errs[campo]) {
          errs[campo] = issue.message;
        }
      }

      setErroresTarjeta(errs);
      setErrorPago(null);
      return;
    }

    setErroresTarjeta({});
    setErrorPago(null);

    setOcupado(true);

    try {
      const res = await procesarPago({
        idFuncion: search.idFuncion,
        metodo,
        tarjeta: {
          nombre: r.data.nombre,
          numero: r.data.numero,
          vencimiento: r.data.vencimiento,
        },
        invitado: search.cuenta ? null : datos,
      });

      if (!res.ok) {
        if (res.vencido) {
          router.replace(hrefAsientos(true));
          return;
        }

        setErrorPago(res.error);
        return;
      }

      setIdReserva(res.idReserva);
      setCorreoEnviado(res.correoEnviado);
      setAprobado(true);
      setDone(true);
    } finally {
      setOcupado(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-[1400px] flex-1 px-6 py-10">
        <FunctionHeader
          title={movie.title}
          subtitle={buildFunctionLabel(
            search.hall,
            search.time,
            search.format,
          )}
        />

        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <ContadorBloqueo
            segundosIniciales={search.segundosRestantes}
            onVencido={() => router.replace(hrefAsientos(true))}
          />

          <div className="flex gap-3">
            <button
              type="button"
              className="btn-ghost"
              disabled={ocupado}
              onClick={() => salir(hrefAsientos(false))}
            >
              Cambiar asientos
            </button>

            <button
              type="button"
              className="btn-ghost"
              disabled={ocupado}
              onClick={() => salir("/")}
            >
              Cancelar compra
            </button>
          </div>
        </div>

        <section
          className={`card-surface p-8 transition-all ${
            paso !== "pago"
              ? "pointer-events-none select-none blur-sm"
              : ""
          }`}
          aria-hidden={paso !== "pago"}
        >
          <div className="grid gap-8 lg:grid-cols-3">
            <div className="space-y-4">
              <h2 className="section-title">
                Datos Personales
              </h2>

              {search.cuenta ? (
                <div className="space-y-3 text-sm">
                  <div>
                    <span className="label">Nombre completo</span>
                    <p>
                      {`${search.cuenta.nombre} ${search.cuenta.apellido}`.trim() ||
                        "—"}
                    </p>
                  </div>

                  <div>
                    <span className="label">
                      Correo Electrónico
                    </span>
                    <p>{search.cuenta.email || "—"}</p>
                  </div>

                  <div>
                    <span className="label">Teléfono</span>
                    <p>{search.cuenta.telefono || "—"}</p>
                  </div>

                  <p className="text-muted-foreground">
                    Compras con los datos de tu cuenta; no es
                    necesario capturarlos de nuevo.
                  </p>
                </div>
              ) : (
                <div className="space-y-3 text-sm">
                  <div>
                    <span className="label">Nombre completo</span>
                    <p>{datos.nombre || "—"}</p>
                  </div>

                  <div>
                    <span className="label">
                      Correo Electrónico
                    </span>
                    <p>{datos.correo || "—"}</p>
                  </div>

                  <div>
                    <span className="label">Teléfono</span>
                    <p>{datos.telefono || "—"}</p>
                  </div>

                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => setPaso("datos")}
                  >
                    Editar mis datos
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <h2 className="section-title">
                Datos de Facturación
              </h2>

              <div>
                <label className="label">Factura</label>

                <select
                  className="field"
                  value={factura}
                  onChange={(e) => setFactura(e.target.value)}
                >
                  <option>Elija una opción</option>
                  <option>C/F</option>
                  <option>NIT</option>
                </select>
              </div>

              <div>
                <label className="label">Nombre</label>
                <input
                  className="field"
                  placeholder="Nombre en factura"
                />
              </div>

              <div>
                <label className="label">Nit</label>
                <input
                  className="field"
                  placeholder="C/F"
                />
              </div>

              <div>
                <label className="label">Dirección</label>
                <input
                  className="field"
                  placeholder="Dirección"
                />
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="section-title">
                Pago
              </h2>

              <div>
                <label
                  className="label"
                  htmlFor="pag-nombre"
                >
                  Nombre en la tarjeta
                </label>

                <input
                  id="pag-nombre"
                  className="field"
                  placeholder="Ana López"
                  value={tarjeta.nombre}
                  onChange={(e) =>
                    setTarjeta({
                      ...tarjeta,
                      nombre: e.target.value,
                    })
                  }
                  aria-invalid={Boolean(erroresTarjeta.nombre)}
                />

                {erroresTarjeta.nombre && (
                  <p
                    role="alert"
                    className="mt-1 text-sm text-destructive"
                  >
                    {erroresTarjeta.nombre}
                  </p>
                )}
              </div>

              <div>
                <label
                  className="label"
                  htmlFor="pag-numero"
                >
                  No. de Tarjeta
                </label>

                <input
                  id="pag-numero"
                  inputMode="numeric"
                  autoComplete="cc-number"
                  className="field"
                  placeholder="0000 0000 0000 0000"
                  value={tarjeta.numero}
                  onChange={(e) =>
                    setTarjeta({
                      ...tarjeta,
                      numero: e.target.value,
                    })
                  }
                  aria-invalid={Boolean(erroresTarjeta.numero)}
                />

                {erroresTarjeta.numero && (
                  <p
                    role="alert"
                    className="mt-1 text-sm text-destructive"
                  >
                    {erroresTarjeta.numero}
                  </p>
                )}
              </div>

              <div>
                <label
                  className="label"
                  htmlFor="pag-vencimiento"
                >
                  Vencimiento (MM/AA)
                </label>

                <input
                  id="pag-vencimiento"
                  inputMode="numeric"
                  autoComplete="cc-exp"
                  className="field"
                  placeholder="07/28"
                  value={tarjeta.vencimiento}
                  onChange={(e) =>
                    setTarjeta({
                      ...tarjeta,
                      vencimiento: e.target.value,
                    })
                  }
                  aria-invalid={Boolean(
                    erroresTarjeta.vencimiento,
                  )}
                />

                {erroresTarjeta.vencimiento && (
                  <p
                    role="alert"
                    className="mt-1 text-sm text-destructive"
                  >
                    {erroresTarjeta.vencimiento}
                  </p>
                )}
              </div>

              <div>
                <label
                  className="label"
                  htmlFor="pag-cvv"
                >
                  CVV
                </label>

                <input
                  id="pag-cvv"
                  type="password"
                  inputMode="numeric"
                  autoComplete="cc-csc"
                  maxLength={4}
                  className="field"
                  placeholder="123"
                  value={tarjeta.cvv}
                  onChange={(e) =>
                    setTarjeta({
                      ...tarjeta,
                      cvv: e.target.value,
                    })
                  }
                  aria-invalid={Boolean(erroresTarjeta.cvv)}
                />

                {erroresTarjeta.cvv && (
                  <p
                    role="alert"
                    className="mt-1 text-sm text-destructive"
                  >
                    {erroresTarjeta.cvv}
                  </p>
                )}
              </div>

              <div>
                <label
                  className="label"
                  htmlFor="pag-metodo"
                >
                  Tipo de tarjeta
                </label>

                <select
                  id="pag-metodo"
                  className="field"
                  value={metodo}
                  onChange={(e) =>
                    setMetodo(e.target.value as MetodoPago)
                  }
                >
                  {METODOS_PAGO.map((m) => (
                    <option
                      key={m.id}
                      value={m.id}
                    >
                      {m.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-between border-t border-border pt-4">
                <span className="text-sm text-muted-foreground">
                  Total a pagar
                </span>

                <span className="text-lg font-bold text-primary">
                  {quetzales(search.total)}
                </span>
              </div>

              {errorPago && (
                <div
                  role="alert"
                  className="rounded-md border border-destructive bg-destructive/10 p-3 text-center text-sm text-destructive"
                >
                  {errorPago}
                </div>
              )}
            </div>
          </div>

          <label className="mt-6 flex items-start gap-3 text-sm text-muted-foreground">
            <input
              type="checkbox"
              defaultChecked
              className="mt-0.5 h-4 w-4 accent-[var(--primary)]"
            />
            He leído y estoy de acuerdo con los Términos y
            Condiciones y Aviso de Privacidad
          </label>

          <div className="mt-6 flex justify-end">
            <button
              type="button"
              className="btn-primary px-12"
              onClick={pagar}
              disabled={ocupado || aprobado}
            >
              {ocupado
                ? "Procesando..."
                : aprobado
                  ? "Pago aprobado"
                  : "Pagar"}
            </button>
          </div>
        </section>
      </main>

      <SiteFooter />

      {paso === "eleccion" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="card-surface w-full max-w-md p-6">
            <div>
              <h2 className="text-2xl tracking-wide">
                ¿Ya eres miembro?
              </h2>

              <p className="mt-1 text-sm text-muted-foreground">
                Elige cómo quieres continuar con tu compra.
              </p>
            </div>

            <div className="mt-5 space-y-3">
              <Link
                href={hrefLogin}
                className="btn-primary block w-full text-center"
              >
                Iniciar sesión
              </Link>

              <button
                type="button"
                className="btn-light block w-full"
                onClick={() => setPaso("datos")}
              >
                Continuar como invitado
              </button>
            </div>
          </div>
        </div>
      )}

      {paso === "datos" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <form
            className="card-surface w-full max-w-md p-6"
            onSubmit={continuarDatos}
            noValidate
          >
            <div>
              <h2 className="text-2xl tracking-wide">
                Datos del invitado
              </h2>

              <p className="mt-1 text-sm text-muted-foreground">
                Usaremos estos datos para registrarte la reserva y
                enviarte tu boleto.
              </p>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label
                  className="label"
                  htmlFor="inv-nombre"
                >
                  Nombre completo
                </label>

                <input
                  id="inv-nombre"
                  className="field"
                  placeholder="Ana López"
                  value={datos.nombre}
                  onChange={(e) =>
                    setDatos({
                      ...datos,
                      nombre: e.target.value,
                    })
                  }
                  aria-invalid={Boolean(errores.nombre)}
                />

                {errores.nombre && (
                  <p
                    role="alert"
                    className="mt-1 text-sm text-destructive"
                  >
                    {errores.nombre}
                  </p>
                )}
              </div>

              <div>
                <label
                  className="label"
                  htmlFor="inv-correo"
                >
                  Correo electrónico
                </label>

                <input
                  id="inv-correo"
                  type="email"
                  className="field"
                  placeholder="correo@ejemplo.com"
                  value={datos.correo}
                  onChange={(e) =>
                    setDatos({
                      ...datos,
                      correo: e.target.value,
                    })
                  }
                  aria-invalid={Boolean(errores.correo)}
                />

                {errores.correo && (
                  <p
                    role="alert"
                    className="mt-1 text-sm text-destructive"
                  >
                    {errores.correo}
                  </p>
                )}
              </div>

              <div>
                <label
                  className="label"
                  htmlFor="inv-telefono"
                >
                  Teléfono
                </label>

                <input
                  id="inv-telefono"
                  type="tel"
                  className="field"
                  placeholder="5555 1234"
                  value={datos.telefono}
                  onChange={(e) =>
                    setDatos({
                      ...datos,
                      telefono: e.target.value,
                    })
                  }
                  aria-invalid={Boolean(errores.telefono)}
                />

                {errores.telefono && (
                  <p
                    role="alert"
                    className="mt-1 text-sm text-destructive"
                  >
                    {errores.telefono}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <button
                type="submit"
                className="btn-primary w-full"
              >
                Continuar al pago
              </button>

              <button
                type="button"
                className="btn-ghost w-full"
                onClick={() => setPaso("eleccion")}
              >
                Volver
              </button>
            </div>
          </form>
        </div>
      )}

      <Modal
        open={done}
        title="Compra confirmada"
        onClose={() => setDone(false)}
        footer={
          <Link
            href="/"
            className="btn-primary"
            onClick={() => setDone(false)}
          >
            Volver a cartelera
          </Link>
        }
      >
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <CheckCircle2 className="h-14 w-14 text-primary" />

          <p className="text-lg font-semibold">
            ¡Gracias por tu compra!
          </p>

          {idReserva !== null && (
            <p className="text-sm">
              Número de reserva:{" "}
              <span className="font-bold text-primary">
                {numeroReserva(idReserva)}
              </span>
            </p>
          )}

          <p className="text-sm text-muted-foreground">
            {movie.title} ·{" "}
            {search.hall || "Sala 1 Regular 2D"} ·{" "}
            {search.time || "18:00"} Hrs. · Asientos{" "}
            {search.seats
              ? search.seats.split(",").join(", ")
              : "—"}
          </p>

          <p className="text-sm text-muted-foreground">
            Total pagado:{" "}
            <span className="font-bold text-primary">
              Q.{(search.total || 94.5).toFixed(2)}
            </span>
          </p>

          {correoEnviado === true && (
            <p className="text-sm text-muted-foreground">
              Enviamos tu boleto con código QR a{" "}
              <span className="font-medium text-foreground">
                {search.cuenta?.email || datos.correo}
              </span>
              .
            </p>
          )}

          {correoEnviado === false && (
            <p className="text-xs text-muted-foreground">
              No pudimos enviarte el boleto por correo; conserva tu
              número de reserva.
            </p>
          )}
        </div>
      </Modal>
    </div>
  );
}