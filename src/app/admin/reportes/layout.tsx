import { ReportesTabs } from "@/components/admin/ReportesTabs";

/** Marco común de los reportes del panel: pestañas para cambiar de reporte. El acceso (solo Administrador) lo controla cada página/ruta. */
export default function ReportesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <ReportesTabs />
      {children}
    </div>
  );
}
