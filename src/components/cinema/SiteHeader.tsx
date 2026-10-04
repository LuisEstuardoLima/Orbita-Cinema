import Link from "next/link";
import { CircleUserRound, Film } from "lucide-react";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-6">
        {/* Logo y "Cartelera" van a la cartelera limpia: href "/" sin query para que se limpien
            los filtros guardados en la URL (/?fecha=...&q=...). */}
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Film className="h-5 w-5" />
          </span>
          <span className="font-display text-2xl tracking-widest">
            ÓRBITA <span className="text-primary">CINEMA</span>
          </span>
        </Link>
        <nav className="hidden items-center gap-7 text-sm font-medium text-muted-foreground md:flex">
          <Link href="/" className="transition-colors hover:text-primary">
            Cartelera
          </Link>
          <Link href="/perfil" className="transition-colors hover:text-primary">
            Mi perfil
          </Link>
        </nav>
        <Link href="/login" className="flex items-center gap-2 text-sm text-secondary">
          <CircleUserRound className="h-6 w-6" />
          <span className="hidden sm:inline">Usuario</span>
        </Link>
      </div>
    </header>
  );
}
