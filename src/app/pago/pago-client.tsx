"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { CheckCircle2, Download, Printer } from "lucide-react";
import { SiteHeader } from "@/components/cinema/SiteHeader";
import { SiteFooter } from "@/components/cinema/SiteFooter";
import { FunctionHeader } from "@/components/cinema/FunctionHeader";
import { Modal } from "@/components/cinema/Modal";
import { getMovie } from "@/lib/cinema-data";
import { ContadorBloqueo } from "@/components/cinema/ContadorBloqueo";
import { datosInvitadoSchema, datosTarjetaSchema, METODOS_PAGO, numeroReserva, quetzales, soloDigitos, type Cantidades, type DatosInvitado, type DatosTarjeta, type MetodoPago } from "@/lib/compra";
import { toHref } from "@/lib/search-params";
import { liberarBloqueo } from "@/app/asientos/actions";
import { procesarPago } from "./actions";

type Props = {
  slug: string;
  /** Título real de la película según la BD; llega vacío solo si la función ya no existe. */
  titulo: string;
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
  cuenta: { nombre: string; apellido: string; email: string; telefono: string } | null;
};

export function PagoClient(search: Props) {
  // Título real desde la BD (page.tsx); getMovie es solo un respaldo del catálogo estático.
  const titulo = search.titulo || getMovie(search.slug).title;
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
    nombre: search.cuenta ? `${search.cuenta.nombre} ${search.cuenta.apellido}`.trim() : "",
    correo: search.cuenta?.email ?? "",
    telefono: search.cuenta?.telefono ?? "",
  });
  const [errores, setErrores] = useState<Partial<Record<keyof DatosInvitado, string>>>({});

  // Ticket de pago: formulario de tarjeta con validación y resultado simulado.
  const [tarjeta, setTarjeta] = useState<DatosTarjeta>({
    nombre: "",
    numero: "",
    vencimiento: "",
    cvv: "",
  });
  const [erroresTarjeta, setErroresTarjeta] = useState<Partial<Record<keyof DatosTarjeta, string>>>({});
  const [errorPago, setErrorPago] = useState<string | null>(null);
  // El checkbox de Términos y Condiciones arranca desmarcado; sin él no se puede pagar.
  const [aceptaTerminos, setAceptaTerminos] = useState(false);
  const [aprobado, setAprobado] = useState(false);
  const [metodo, setMetodo] = useState<MetodoPago>("tarjeta_credito");
  const [idReserva, setIdReserva] = useState<number | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [correoEnviado, setCorreoEnviado] = useState<boolean | null>(null);

  // Para que "Iniciar sesión" vuelva a ESTA compra con todos sus parámetros.
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hrefLogin = `/login?next=${encodeURIComponent(`${pathname}?${searchParams.toString()}`)}`;

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
        if (!errs[campo]) errs[campo] = issue.message;
      }
      setErrores(errs);
      return;
    }
    setErrores({});
    setDatos(r.data); // con el .trim() del schema ya aplicado
    setPaso("pago");
  };

  // CA2/CA3/CA4: valida la tarjeta en el navegador, llama a la pasarela
  // simulada (que revalida en servidor y comprueba el bloqueo) y según el
  // resultado muestra rechazo reintentable o abre la confirmación (CA3).
  const pagar = async () => {
    if (ocupado || aprobado) return; // CA5: sin pagos duplicados.

    // Sin los Términos y Condiciones aceptados no se realiza el pago.
    if (!aceptaTerminos) {
      setErrorPago("Debes aceptar los Términos y Condiciones y el Aviso de Privacidad para pagar.");
      return;
    }

    // CA3 (defensa): nunca se llega al cobro sin datos de comprador válidos.
    if (!search.cuenta && !datosInvitadoSchema.safeParse(datos).success) {
      setPaso("datos");
      return;
    }

    const r = datosTarjetaSchema.safeParse(tarjeta);
    if (!r.success) {
      const errs: Partial<Record<keyof DatosTarjeta, string>> = {};
      for (const issue of r.error.issues) {
        const campo = issue.path[0] as keyof DatosTarjeta;
        if (!errs[campo]) errs[campo] = issue.message;
      }
      setErroresTarjeta(errs);
      setErrorPago(null);
      return;
    }
    setErroresTarjeta({});
    setErrorPago(null);

    setOcupado(true); // CA5: botón deshabilitado mientras procesa.
    try {
      const res = await procesarPago({
        idFuncion: search.idFuncion,
        metodo,
        // El CVV queda en el navegador: nunca viaja al servidor (CA6).
        tarjeta: { nombre: r.data.nombre, numero: r.data.numero, vencimiento: r.data.vencimiento },
        // Con cuenta, el servidor ignora esto y usa los datos de la cuenta (CA5).
        invitado: search.cuenta ? null : datos,
      });
      if (!res.ok) {
        if (res.vencido) {
          // El bloqueo venció mientras se capturaba: regresa a elegir asientos.
          router.replace(hrefAsientos(true));
          return;
        }
        setErrorPago(res.error); // CA4: rechazo con aviso y se puede reintentar.
        return;
      }
      setIdReserva(res.idReserva);
      setQrDataUrl(res.qrDataUrl);
      setCorreoEnviado(res.correoEnviado);
      setAprobado(true);
      setDone(true); // CA3: pago aprobado -> pantalla de confirmación.
    } finally {
      setOcupado(false);
    }
  };

  const codigoReserva = idReserva !== null ? numeroReserva(idReserva) : "ORB-000000";
  const nombreComprador = search.cuenta
    ? `${search.cuenta.nombre} ${search.cuenta.apellido}`.trim()
    : datos.nombre;
  const asientosTexto = search.seats ? search.seats.split(",").join(", ") : "—";

  // Genera una imagen PNG completa con los datos del boleto + el código QR.
  const descargarBoletoPng = async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 820;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#0f0f10";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#1a1a1c";
    ctx.strokeStyle = "#2d2d32";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(32, 32, canvas.width - 64, canvas.height - 64, 16);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#ef4444";
    ctx.font = "bold 24px Arial, sans-serif";
    ctx.fillText("ÓRBITA CINEMA", 64, 84);
    ctx.fillStyle = "#a1a1aa";
    ctx.font = "14px Arial, sans-serif";
    ctx.fillText("COMPROBANTE DE COMPRA · BOLETO DE ENTRADA", 64, 110);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 26px Arial, sans-serif";
    ctx.fillText(titulo.slice(0, 34), 64, 160);

    const filas: [string, string][] = [
      ["Reserva", codigoReserva],
      ["Comprador", (nombreComprador || "Invitado").slice(0, 36)],
      ["Sala", search.hall || "Sala 1 Regular 2D"],
      ["Horario", `${search.time || "18:00"} Hrs.`],
      ["Asientos", asientosTexto],
      ["Total pagado", quetzales(search.total || 94.5)],
    ];

    let y = 210;
    for (const [etiqueta, valor] of filas) {
      ctx.fillStyle = "#a1a1aa";
      ctx.font = "15px Arial, sans-serif";
      ctx.fillText(etiqueta, 64, y);
      ctx.fillStyle = etiqueta === "Reserva" ? "#ef4444" : "#ffffff";
      ctx.font = etiqueta === "Reserva" ? "bold 17px Arial, sans-serif" : "bold 15px Arial, sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(valor, canvas.width - 64, y);
      ctx.textAlign = "left";
      y += 38;
    }

    if (qrDataUrl) {
      const img = new Image();
      img.src = qrDataUrl;
      await new Promise<void>((resolve) => {
        img.onload = () => resolve();
        img.onerror = () => resolve();
      });
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.roundRect((canvas.width - 236) / 2, 460, 236, 236, 12);
      ctx.fill();
      ctx.drawImage(img, (canvas.width - 212) / 2, 472, 212, 212);
    }

    ctx.fillStyle = "#a1a1aa";
    ctx.font = "13px Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Presenta este código QR en la entrada de la sala.", canvas.width / 2, 732);

    const link = document.createElement("a");
    link.download = `boleto-${codigoReserva}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  // Abre una ventana lista para imprimir o guardar como PDF desde el navegador.
  const imprimirBoletoPdf = () => {
    const ventana = window.open("", "_blank", "width=680,height=840");
    if (!ventana) return;
    ventana.document.write(`<!doctype html>
      <html lang="es"><head><meta charset="utf-8" />
        <title>Boleto ${codigoReserva} · Órbita Cinema</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 0; padding: 32px; color: #111; }
          .card { max-width: 480px; margin: 0 auto; border: 2px solid #222; border-radius: 12px; padding: 28px; }
          h1 { margin: 0 0 4px; font-size: 20px; color: #dc2626; }
          .sub { margin: 0 0 20px; font-size: 12px; color: #555; }
          .movie { font-size: 22px; font-weight: bold; margin: 0 0 16px; }
          table { width: 100%; border-collapse: collapse; font-size: 14px; }
          td { padding: 6px 0; border-bottom: 1px solid #eee; }
          td:last-child { text-align: right; font-weight: bold; }
          .qr { text-align: center; margin-top: 20px; }
          .qr img { width: 190px; height: 190px; }
          .note { text-align: center; font-size: 12px; color: #555; margin-top: 8px; }
        </style>
      </head><body>
        <div class="card">
          <h1>ÓRBITA CINEMA</h1>
          <p class="sub">COMPROBANTE DE COMPRA · BOLETO DE ENTRADA</p>
          <p class="movie">${titulo}</p>
          <table>
            <tr><td>Número de reserva</td><td>${codigoReserva}</td></tr>
            <tr><td>Comprador</td><td>${nombreComprador || "Invitado"}</td></tr>
            <tr><td>Sala</td><td>${search.hall || "Sala 1 Regular 2D"}</td></tr>
            <tr><td>Horario</td><td>${search.time || "18:00"} Hrs.</td></tr>
            <tr><td>Asientos</td><td>${asientosTexto}</td></tr>
            <tr><td>Total pagado</td><td>${quetzales(search.total || 94.5)}</td></tr>
          </table>
          ${qrDataUrl ? `<div class="qr"><img src="${qrDataUrl}" alt="Código QR" /></div>` : ""}
          <p class="note">Presenta este código QR en la entrada de la sala.</p>
        </div>
        <script>window.onload = () => { window.print(); };</script>
      </body></html>`);
    ventana.document.close();
  };

  // "4242424242424242" -> "4242 4242 4242 4242" (máx. 16 dígitos).
  const formatearNumeroTarjeta = (v: string) =>
    soloDigitos(v).slice(0, 16).replace(/(\d{4})(?=\d)/g, "$1 ").trim();

  // "0728" -> "07/28": la diagonal se inserta sola tras los dos primeros dígitos.
  const formatearVencimiento = (v: string) => {
    const d = soloDigitos(v).slice(0, 4);
    return d.length <= 2 ? d : `${d.slice(0, 2)}/${d.slice(2)}`;
  };

  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="mx-auto w-full max-w-[1400px] flex-1 px-6 py-10">
        <FunctionHeader
          title={`${titulo} · ${search.hall || "Sala 1 Regular 2D"} · ${search.time || "18:00"} Hrs.`}
          subtitle={search.format || "2D Doblada / Esp"}
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
            paso !== "pago" ? "pointer-events-none select-none blur-sm" : ""
          }`}
          aria-hidden={paso !== "pago"}
        >
          <div className="grid gap-8 lg:grid-cols-3">
            <div className="space-y-4">
              <h2 className="section-title">Datos Personales</h2>
              {search.cuenta ? (
                // CA5: con sesión no se piden datos; se muestran los de la cuenta.
                <div className="space-y-3 text-sm">
                  <div>
                    <span className="label">Nombre completo</span>
                    <p>{`${search.cuenta.nombre} ${search.cuenta.apellido}`.trim() || "—"}</p>
                  </div>
                  <div>
                    <span className="label">Correo Electrónico</span>
                    <p>{search.cuenta.email || "—"}</p>
                  </div>
                  <div>
                    <span className="label">Teléfono</span>
                    <p>{search.cuenta.telefono || "—"}</p>
                  </div>
                  <p className="text-muted-foreground">
                    Compras con los datos de tu cuenta; no es necesario capturarlos de nuevo.
                  </p>
                </div>
              ) : (
                // CA4: los datos que el invitado capturó en el paso anterior.
                <div className="space-y-3 text-sm">
                  <div>
                    <span className="label">Nombre completo</span>
                    <p>{datos.nombre || "—"}</p>
                  </div>
                  <div>
                    <span className="label">Correo Electrónico</span>
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
              <h2 className="section-title">Datos de Facturación</h2>
              <div>
                <label className="label">Factura</label>
                <select
                  className="field"
                  value={factura}
                  onChange={(e) => setFactura(e.target.value)}
                >
                  <option>C/F</option>
                  <option>NIT</option>
                </select>
              </div>
              {/* NIT permite capturar; C/F bloquea los campos. */}
              <div>
                <label className="label">Nombre</label>
                <input
                  className="field disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="Nombre en factura"
                  disabled={factura !== "NIT"}
                />
              </div>
              <div>
                <label className="label">Nit</label>
                <input
                  className="field disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="C/F"
                  disabled={factura !== "NIT"}
                />
              </div>
              <div>
                <label className="label">Dirección</label>
                <input
                  className="field disabled:cursor-not-allowed disabled:opacity-50"
                  placeholder="Dirección"
                  disabled={factura !== "NIT"}
                />
              </div>
              {factura !== "NIT" && (
                <p className="text-xs text-muted-foreground">
                  Factura C/F: los campos de facturación quedan bloqueados.
                </p>
              )}
            </div>

            <div className="space-y-4">
              <h2 className="section-title">Pago</h2>
              <div>
                <label className="label" htmlFor="pag-nombre">
                  Nombre en la tarjeta
                </label>
                <input
                  id="pag-nombre"
                  className="field"
                  placeholder="Ana López"
                  value={tarjeta.nombre}
                  onChange={(e) => setTarjeta({ ...tarjeta, nombre: e.target.value })}
                  aria-invalid={Boolean(erroresTarjeta.nombre)}
                />
                {erroresTarjeta.nombre && (
                  <p role="alert" className="mt-1 text-sm text-destructive">
                    {erroresTarjeta.nombre}
                  </p>
                )}
              </div>
              <div>
                <label className="label" htmlFor="pag-numero">
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
                    // Un espacio cada 4 dígitos: "4242 4242 4242 4242".
                    setTarjeta({ ...tarjeta, numero: formatearNumeroTarjeta(e.target.value) })
                  }
                  aria-invalid={Boolean(erroresTarjeta.numero)}
                />
                {erroresTarjeta.numero && (
                  <p role="alert" className="mt-1 text-sm text-destructive">
                    {erroresTarjeta.numero}
                  </p>
                )}
              </div>
              <div>
                <label className="label" htmlFor="pag-vencimiento">
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
                    // La diagonal se agrega sola: "0728" -> "07/28".
                    setTarjeta({ ...tarjeta, vencimiento: formatearVencimiento(e.target.value) })
                  }
                  aria-invalid={Boolean(erroresTarjeta.vencimiento)}
                />
                {erroresTarjeta.vencimiento && (
                  <p role="alert" className="mt-1 text-sm text-destructive">
                    {erroresTarjeta.vencimiento}
                  </p>
                )}
              </div>
              <div>
                <label className="label" htmlFor="pag-cvv">
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
                  onChange={(e) => setTarjeta({ ...tarjeta, cvv: e.target.value })}
                  aria-invalid={Boolean(erroresTarjeta.cvv)}
                />
                {erroresTarjeta.cvv && (
                  <p role="alert" className="mt-1 text-sm text-destructive">
                    {erroresTarjeta.cvv}
                  </p>
                )}
              </div>
              <div>
                <label className="label" htmlFor="pag-metodo">
                  Tipo de tarjeta
                </label>
                <select
                  id="pag-metodo"
                  className="field"
                  value={metodo}
                  onChange={(e) => setMetodo(e.target.value as MetodoPago)}
                >
                  {METODOS_PAGO.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-between border-t border-border pt-4">
                <span className="text-sm text-muted-foreground">Total a pagar</span>
                <span className="text-lg font-bold text-primary">{quetzales(search.total)}</span>
              </div>

              {errorPago && (
                <div
                  role="alert"
                  className="bg-destructive/10 border border-destructive text-destructive p-3 rounded-md text-sm text-center"
                >
                  {errorPago}
                </div>
              )}
            </div>
          </div>

          <label className="mt-6 flex items-start gap-3 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={aceptaTerminos}
              onChange={(e) => setAceptaTerminos(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[var(--primary)]"
            />
            He leído y estoy de acuerdo con los Términos y Condiciones y Aviso de Privacidad
          </label>

          <div className="mt-6 flex justify-end">
            <button
              type="button"
              className="btn-primary px-12"
              onClick={pagar}
              disabled={ocupado || aprobado}
            >
              {ocupado ? "Procesando..." : aprobado ? "Pago aprobado" : "Pagar"}
            </button>
          </div>
        </section>
      </main>

      <SiteFooter />

      {paso === "eleccion" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="card-surface w-full max-w-md p-6">
            <div>
              <h2 className="text-2xl tracking-wide">¿Ya eres miembro?</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Elige cómo quieres continuar con tu compra.
              </p>
            </div>

            <div className="mt-5 space-y-3">
              <Link href={hrefLogin} className="btn-primary block w-full text-center">
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
          <form className="card-surface w-full max-w-md p-6" onSubmit={continuarDatos} noValidate>
            <div>
              <h2 className="text-2xl tracking-wide">Datos del invitado</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Usaremos estos datos para registrarte la reserva y enviarte tu boleto.
              </p>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label className="label" htmlFor="inv-nombre">
                  Nombre completo
                </label>
                <input
                  id="inv-nombre"
                  className="field"
                  placeholder="Ana López"
                  value={datos.nombre}
                  onChange={(e) => setDatos({ ...datos, nombre: e.target.value })}
                  aria-invalid={Boolean(errores.nombre)}
                />
                {errores.nombre && (
                  <p role="alert" className="mt-1 text-sm text-destructive">
                    {errores.nombre}
                  </p>
                )}
              </div>
              <div>
                <label className="label" htmlFor="inv-correo">
                  Correo electrónico
                </label>
                <input
                  id="inv-correo"
                  type="email"
                  className="field"
                  placeholder="correo@ejemplo.com"
                  value={datos.correo}
                  onChange={(e) => setDatos({ ...datos, correo: e.target.value })}
                  aria-invalid={Boolean(errores.correo)}
                />
                {errores.correo && (
                  <p role="alert" className="mt-1 text-sm text-destructive">
                    {errores.correo}
                  </p>
                )}
              </div>
              <div>
                <label className="label" htmlFor="inv-telefono">
                  Teléfono
                </label>
                <input
                  id="inv-telefono"
                  type="tel"
                  className="field"
                  placeholder="5555 1234"
                  value={datos.telefono}
                  onChange={(e) => setDatos({ ...datos, telefono: e.target.value })}
                  aria-invalid={Boolean(errores.telefono)}
                />
                {errores.telefono && (
                  <p role="alert" className="mt-1 text-sm text-destructive">
                    {errores.telefono}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <button type="submit" className="btn-primary w-full">
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
        sinCerrar
        footer={
          <Link href="/" className="btn-primary" onClick={() => setDone(false)}>
            Volver a cartelera
          </Link>
        }
      >
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <CheckCircle2 className="h-14 w-14 text-primary" />
          <p className="text-lg font-semibold">¡Gracias por tu compra!</p>
          {idReserva !== null && (
            <p className="text-sm">
              Número de reserva:{" "}
              <span className="font-bold text-primary">{numeroReserva(idReserva)}</span>
            </p>
          )}
          <p className="text-sm text-muted-foreground">
            {titulo} · {search.hall || "Sala 1 Regular 2D"} ·{" "}
            {search.time || "18:00"} Hrs. · Asientos{" "}
            {search.seats ? search.seats.split(",").join(", ") : "—"}
          </p>
          <p className="text-sm text-muted-foreground">
            Total pagado:{" "}
            <span className="font-bold text-primary">
              Q.{(search.total || 94.5).toFixed(2)}
            </span>
          </p>
          {qrDataUrl && (
            <div className="my-2 flex flex-col items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrDataUrl}
                alt={`Código QR del boleto ${codigoReserva}`}
                className="h-44 w-44 rounded-lg bg-white p-2 shadow"
              />
              <span className="text-xs text-muted-foreground">
                Presenta este código QR en la entrada
              </span>
            </div>
          )}
          <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={descargarBoletoPng}
              className="btn-secondary inline-flex items-center gap-2 text-xs"
            >
              <Download className="h-4 w-4" />
              Descargar boleto (PNG)
            </button>
            <button
              type="button"
              onClick={imprimirBoletoPdf}
              className="btn-ghost inline-flex items-center gap-2 text-xs"
            >
              <Printer className="h-4 w-4" />
              Guardar PDF / Imprimir
            </button>
          </div>
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
              También puedes descargar o guardar en PDF tu boleto aquí arriba.
            </p>
          )}
        </div>
      </Modal>
    </div>
  );
}
