import type { Metadata } from "next";
import Link from "next/link";
import { Film } from "lucide-react";

export const metadata: Metadata = {
  title: "Iniciar sesión | Órbita Cinema",
  description: "Accede a tu cuenta de Órbita Cinema para comprar boletos y ver tu historial.",
  openGraph: {
    title: "Iniciar sesión | Órbita Cinema",
    description: "Accede a tu cuenta de Órbita Cinema.",
  },
};

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="card-surface w-full max-w-md p-8">
        <div className="mb-8 flex flex-col items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Film className="h-6 w-6" />
          </span>
          <span className="font-display text-2xl tracking-widest">
            ÓRBITA <span className="text-primary">CINEMA</span>
          </span>
        </div>

        <h1 className="mb-6 text-center text-3xl tracking-wide">Login</h1>

        <div className="space-y-4">
          <div>
            <label className="label">Email:</label>
            <input className="field" placeholder="correo@ejemplo.com" />
          </div>
          <div>
            <label className="label">Password:</label>
            <input type="password" className="field" placeholder="••••••••" />
          </div>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input type="checkbox" defaultChecked className="h-4 w-4 accent-[var(--primary)]" />
            Remember Me
          </label>
        </div>

        <div className="mt-7 flex items-center justify-between">
          <Link href="/" className="btn-primary">
            Login
          </Link>
          <a href="#" className="text-sm text-muted-foreground hover:text-primary">
            Forgot password?
          </a>
        </div>
      </div>
    </div>
  );
}
