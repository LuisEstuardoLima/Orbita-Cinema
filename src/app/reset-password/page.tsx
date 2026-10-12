import type { Metadata } from "next";
import Link from "next/link";
import { str, type SP } from "@/lib/search-params";
import { ResetPasswordClient } from "./reset-password-client";

export const metadata: Metadata = {
  title: "Restablecer contraseña | Órbita Cinema",
  description: "Crea una nueva contraseña para tu cuenta de Órbita Cinema.",
};

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const code = str(sp["code"]);

  // Sin código no hay nada que canjear: el enlace es inválido o expiró.
  if (!code) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 py-12">
        <div className="card-surface w-full max-w-md p-8 rounded-xl text-center">
          <h1 className="mb-4 text-2xl tracking-wide">Restablecer contraseña</h1>
          <div className="bg-destructive/10 border border-destructive text-destructive p-3 rounded-md mb-4 text-sm">
            El enlace es inválido o expiró. Solicita uno nuevo desde el login.
          </div>
          <Link href="/login" className="text-sm text-primary hover:underline">
            Volver al login
          </Link>
        </div>
      </div>
    );
  }

  // El ?code= viaja oculto en el form: la Server Action lo canjea por una
  // sesión (exchangeCodeForSession) antes de updateUser, ya que en un
  // Server Component no se pueden escribir cookies.
  return <ResetPasswordClient code={code} />;
}