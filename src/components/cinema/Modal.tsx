import { X } from "lucide-react";
import type { ReactNode } from "react";

export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  wide,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div
        className={`card-surface w-full ${wide ? "max-w-2xl" : "max-w-md"} overflow-hidden`}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <h3 className="text-lg tracking-wide">{title}</h3>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-md p-1 text-muted-foreground transition-colors hover:text-primary"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-5 py-5">{children}</div>
        {footer && (
          <div className="flex justify-end gap-3 border-t border-border px-5 py-3.5">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
