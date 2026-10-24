import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { FiltrosReporte, FilaReporte } from "@/lib/reportes";

/**
 * SCRUM-142: consulta del reporte de ventas y reservas. Solo LEE: ejecuta la función SQL
 * `reporte_ventas_reservas` (supabase/sprint4-reportes.sql), que calcula cantidades e importes
 * directamente de reserva / detalle_reserva / pago, sin copiar datos ni modificar nada.
 *
 * Quien llame debe haber verificado antes el rol Administrador (página y route handler lo hacen).
 */

type FilaBd = {
  out_id_pelicula: number | null;
  out_pelicula: string | null;
  out_id_funcion: number | null;
  out_fecha: string | null;
  out_hora: string | null;
  out_sala: string | null;
  out_funciones: number;
  out_reservas_cant: number;
  out_reservas_entr: number;
  out_reservas_importe: number | string;
  out_ventas_cant: number;
  out_ventas_entr: number;
  out_ventas_importe: number | string;
};

export async function consultarReporte(f: FiltrosReporte): Promise<FilaReporte[]> {
  const { data, error } = await createAdminClient().rpc("reporte_ventas_reservas", {
    p_desde: f.desde,
    p_hasta: f.hasta,
    p_agrupar: f.agrupar,
    p_pelicula: f.idPelicula,
  });
  if (error) throw new Error(`reporte_ventas_reservas: ${error.message}`);

  const filas = ((data as FilaBd[] | null) ?? []).map(
    (r): FilaReporte => ({
      idPelicula: r.out_id_pelicula,
      pelicula: r.out_pelicula ?? "—",
      idFuncion: r.out_id_funcion,
      fecha: r.out_fecha,
      hora: r.out_hora ? String(r.out_hora).slice(0, 5) : null,
      sala: r.out_sala,
      funciones: Number(r.out_funciones),
      reservas: {
        cantidad: Number(r.out_reservas_cant),
        entradas: Number(r.out_reservas_entr),
        importe: Number(r.out_reservas_importe),
      },
      ventas: {
        cantidad: Number(r.out_ventas_cant),
        entradas: Number(r.out_ventas_entr),
        importe: Number(r.out_ventas_importe),
      },
    }),
  );

  // Con "solo ventas" no se listan filas que únicamente tienen compras en curso sin pagar (y a la
  // inversa no hace falta filtrar: toda venta es también una reserva vigente).
  return f.tipo === "ventas" ? filas.filter((x) => x.ventas.cantidad > 0) : filas;
}

/** Películas para el filtro (todas, incluso las inactivas: puede haber ventas históricas). */
export async function listPeliculasReporte(): Promise<{ id: number; titulo: string }[]> {
  const { data, error } = await createAdminClient().from("pelicula").select("id, titulo").order("titulo");
  if (error) throw new Error(`pelicula: ${error.message}`);
  return (data as { id: number; titulo: string }[]) ?? [];
}
