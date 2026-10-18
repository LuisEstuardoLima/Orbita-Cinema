"use client";

import { useEffect, useState, useTransition, type FormEvent } from "react";
import { Plus, Search, User } from "lucide-react";
import { Modal } from "@/components/cinema/Modal";
import { cambiarRol, crearCuentaPersonal } from "./actions";
import type { UsuarioAdmin } from "@/lib/db/usuarios";

const ROLES_OPTS = ["Cliente", "Colaborador", "Administrador"] as const;
const ROLES_CREAR = ["Colaborador", "Administrador"] as const;

/** Filtro del select de rol: "" = Todos los roles. */
type RolFiltro = "" | (typeof ROLES_OPTS)[number];

export function AdminUsuariosClient({
  usuarios,
  soloLectura = false,
}: {
  usuarios: UsuarioAdmin[];
  soloLectura?: boolean;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [filtroRol, setFiltroRol] = useState<RolFiltro>("");
  const [creando, setCreando] = useState(false);
  // Valor elegido en el <select> de rol de cada fila (por id_usuario), para
  // habilitar "Guardar" solo cuando el rol realmente cambió.
  const [rolEditado, setRolEditado] = useState<Record<string, string>>({});
  const [pendiente, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<{ texto: string; ok: boolean } | null>(
    null,
  );

  // Los mensajes de éxito desaparecen solos a los 7 segundos.
  useEffect(() => {
    if (!mensaje) return;
    const t = setTimeout(() => setMensaje(null), 7000);
    return () => clearTimeout(t);
  }, [mensaje]);

  // Búsqueda por texto y filtro de rol combinados (ambos en memoria).
  const filtrados = usuarios.filter((u) => {
    const coincideBusqueda =
      u.nombre.toLowerCase().includes(busqueda.trim().toLowerCase()) ||
      u.apellido.toLowerCase().includes(busqueda.trim().toLowerCase()) ||
      u.email.toLowerCase().includes(busqueda.trim().toLowerCase());
    const coincideRol = !filtroRol || u.rol === filtroRol;
    return coincideBusqueda && coincideRol;
  });

  const limpiar = () => {
    setError(null);
    setMensaje(null);
    setRolEditado({});
    setCreando(false);
  };

  const mostrarNombre = (u: UsuarioAdmin) =>
    `${u.nombre} ${u.apellido}`.trim() || u.email;

  const rolLabel = (rol: string) => {
    switch (rol) {
      case "Administrador":
        return "Administrador";
      case "Colaborador":
        return "Colaborador";
      default:
        return "Cliente";
    }
  };

  const handleCambiarRol = async (
    e: FormEvent,
    idUsuario: string,
  ) => {
    e.preventDefault();
    limpiar();
    const formData = new FormData(e.currentTarget as HTMLFormElement);
    formData.set("idUsuario", idUsuario);

    startTransition(async () => {
      const res = await cambiarRol(formData);
      if (!res.ok) {
        setError(res.error);
      } else {
        setMensaje({ texto: "Rol actualizado correctamente.", ok: true });
        // Quitar la entrada de la fila para volver a deshabilitar "Guardar".
        setRolEditado((v) => {
          const sinFila = { ...v };
          delete sinFila[idUsuario];
          return sinFila;
        });
      }
    });
  };

  const handleCrearCuenta = async (e: FormEvent) => {
    e.preventDefault();
    limpiar();
    const formData = new FormData(e.currentTarget as HTMLFormElement);

    startTransition(async () => {
      const res = await crearCuentaPersonal(formData);
      if (!res.ok) {
        setError(res.error);
      } else {
        setMensaje({
          texto: "Cuenta creada y invitación enviada por correo.",
          ok: true,
        });
        setCreando(false);
      }
    });
  };
  return (
    <section className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl tracking-wide">Gestión de usuarios</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Consulta todos los usuarios registrados y gestiona sus roles.
          </p>
        </div>

        {!soloLectura && (
          <button
            type="button"
            onClick={() => setCreando(true)}
            className="btn-primary flex items-center gap-2 disabled:opacity-50"
            disabled={pendiente}
          >
            <Plus className="h-4 w-4" /> Nueva cuenta
          </button>
        )}
      </div>

      {mensaje && (
        <div className="border border-primary/40 bg-primary/10 p-3 rounded-md mb-4 text-sm text-center text-green-600">
          {mensaje.texto}
        </div>
      )}

      {error && (
        <div className="bg-destructive/10 border border-destructive text-destructive p-3 rounded-md mb-4 text-sm text-center">
          {error}
        </div>
      )}

      <div className="card-surface overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-4">
          <div className="relative w-full max-w-sm">
            <Search
              className="absolute left-3 top-3 h-4 w-4 text-muted-foreground"
            />
            <input
              type="text"
              placeholder="Buscar por nombre o correo…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="field pl-9"
            />
          </div>

          {/* Filtro por rol: misma estética que el de estado en /admin/salas */}
          <select
            aria-label="Filtrar por rol"
            className="field w-auto min-w-[150px]"
            value={filtroRol}
            onChange={(e) => setFiltroRol(e.target.value as RolFiltro)}
          >
            <option value="">Todos los roles</option>
            {ROLES_OPTS.map((r) => (
              <option key={r} value={r}>
                {rolLabel(r)}
              </option>
            ))}
          </select>

          <span className="text-sm text-muted-foreground">
            {filtrados.length} usuario{filtrados.length !== 1 ? "s" : ""}
          </span>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-2">
              <th className="px-5 py-3 text-left text-muted-foreground font-semibold">
                Nombre
              </th>
              <th className="px-5 py-3 text-left text-muted-foreground font-semibold">
                Correo electrónico
              </th>
              <th className="px-5 py-3 text-left text-muted-foreground font-semibold">
                Rol
              </th>
              <th className="px-5 py-3 text-right text-muted-foreground font-semibold">
                {soloLectura ? "" : "Cambiar rol"}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtrados.length === 0 ? (
              <tr>
                <td className="px-5 py-8 text-center text-muted-foreground" colSpan={4}>
                  No se encontraron usuarios.
                </td>
              </tr>
            ) : (
              filtrados.map((u) => (
                <tr key={u.id_usuario} className="hover:bg-surface-2/50">
                  <td className="px-5 py-4 text-foreground">
                    {mostrarNombre(u)}{" "}
                    {!u.confirmado && (
                      <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100 text-amber-700 text-[10px] font-semibold">
                        Pendiente
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-muted-foreground">
                    {u.email}
                  </td>
                  <td className="px-5 py-4 text-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                      {rolLabel(u.rol)}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    {!soloLectura && (
                      <form
                        onSubmit={(e) =>
                          handleCambiarRol(e, u.id_usuario)
                        }
                        className="flex items-center gap-2"
                      >
                        <select
                          name="nuevoRol"
                          defaultValue={u.rol}
                          onChange={(e) =>
                            setRolEditado((v) => ({
                              ...v,
                              [u.id_usuario]: e.target.value,
                            }))
                          }
                          className="field border border-border bg-surface-2 text-secondary focus:border-primary focus:ring-primary accent-[var(--primary)]"
                          disabled={pendiente}
                        >
                          {ROLES_OPTS.map((r) => (
                            <option key={r} value={r}>
                              {rolLabel(r)}
                            </option>
                          ))}
                        </select>
                        <input
                          type="hidden"
                          name="idUsuario"
                          value={u.id_usuario}
                        />
                        <button
                          type="submit"
                          className="btn-primary btn-xs disabled:opacity-50"
                          disabled={
                            pendiente ||
                            (rolEditado[u.id_usuario] ?? u.rol) === u.rol
                          }
                          aria-label={`Cambiar rol de ${mostrarNombre(u)}`}
                        >
                          Guardar
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal: nueva cuenta */}
      <Modal
        open={creando}
        title="Registrar nueva cuenta"
        onClose={() => setCreando(false)}
        footer={
          <>
            <button
              type="button"
              onClick={() => setCreando(false)}
              className="btn-ghost disabled:opacity-50"
              disabled={pendiente}
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="form-crear-cuenta"
              className="btn-primary disabled:opacity-50"
              disabled={pendiente}
            >
              {pendiente ? "Creando…" : "Crear cuenta"}
            </button>
          </>
        }
      >
        <form
          id="form-crear-cuenta"
          onSubmit={handleCrearCuenta}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label" htmlFor="nombre">Nombre</label>
              <input
                type="text"
                id="nombre"
                name="nombre"
                className="field"
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="apellido">Apellido</label>
              <input
                type="text"
                id="apellido"
                name="apellido"
                className="field"
                required
              />
            </div>
          </div>
          <div>
            <label className="label" htmlFor="telefono">Teléfono</label>
            <input
              type="tel"
              id="telefono"
              name="telefono"
              className="field"
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="email">Correo Electrónico</label>
            <input
              type="email"
              id="email"
              name="email"
              className="field"
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="rol">Rol</label>
            <select
              id="rol"
              name="rol"
              className="field border border-border bg-surface-2 text-secondary focus:border-primary focus:ring-primary accent-[var(--primary)]"
              required
            >
              {ROLES_CREAR.map((r) => (
                <option key={r} value={r}>
                  {rolLabel(r)}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-muted-foreground">
              Se enviará una invitación por correo para que el usuario cree su
              propia contraseña.
            </p>
          </div>
        </form>
      </Modal>
    </section>
  );
}

