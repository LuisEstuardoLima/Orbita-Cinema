"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation"; // Importamos useRouter
import { CircleUserRound, Film, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cerrarSesion } from "@/lib/auth/actions";

export function SiteHeader() {
  const [nombreUsuario, setNombreUsuario] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  
  const pathname = usePathname(); 
  const router = useRouter(); // Inicializamos el router

  useEffect(() => {
    const supabase = createClient();

    async function cargarPerfil(usuario: any) {
      if (usuario) {
        const { data: perfil } = await supabase
          .from("perfiles")
          .select("nombre")
          .eq("id", usuario.id)
          .single();
          
        if (perfil) {
          setNombreUsuario(perfil.nombre);
        } else {
          setNombreUsuario(null);
        }
      } else {
        setNombreUsuario(null);
      }
      setCargando(false);
    }

    supabase.auth.getUser().then(({ data: { user } }) => {
      cargarPerfil(user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      cargarPerfil(session?.user);
      
      // LA MAGIA AQUÍ: Si el usuario entra o sale, forzamos a Next.js a actualizar la caché
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        router.refresh();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [pathname, router]);

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-6">
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
          {nombreUsuario && (
            <Link href="/perfil" className="transition-colors hover:text-primary">
              Mi perfil
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-5">
          {cargando ? (
            <div className="h-8 w-24 animate-pulse rounded bg-muted"></div>
          ) : nombreUsuario ? (
            <>
              <Link href="/perfil" className="flex items-center gap-2 text-sm text-secondary hover:text-primary transition-colors">
                <CircleUserRound className="h-6 w-6" />
                <span className="hidden sm:inline font-semibold">Hola, {nombreUsuario}</span>
              </Link>
              <form action={cerrarSesion}>
                <button type="submit" className="px-4 py-2 text-sm flex items-center gap-2 text-muted-foreground hover:text-destructive transition-colors">
                  <LogOut className="h-5 w-5" />
                  <span className="hidden sm:inline">Salir</span>
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/registro" className="btn-primary px-4 py-2 text-sm">
                Crear cuenta
              </Link>
              <Link href="/login" className="flex items-center gap-2 text-sm text-secondary hover:text-primary transition-colors">
                <CircleUserRound className="h-6 w-6" />
                <span className="hidden sm:inline">Ingresar</span>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
