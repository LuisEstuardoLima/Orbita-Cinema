"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

export function EntradasSearch({
  initialSearch,
}: {
  initialSearch: string;
}) {
  const router = useRouter();
  const [search, setSearch] = useState(initialSearch);

  useEffect(() => {
    setSearch(initialSearch);
  }, [initialSearch]);

  useEffect(() => {
    if (search.trim() === initialSearch.trim()) return;

    const timer = window.setTimeout(() => {
      const value = search.trim();
      router.replace(
        value
          ? `/admin/entradas?buscar=${encodeURIComponent(value)}`
          : "/admin/entradas",
        { scroll: false },
      );
    }, 300);

    return () => window.clearTimeout(timer);
  }, [initialSearch, router, search]);

  const buscarAhora = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = search.trim();
    router.replace(
      value
        ? `/admin/entradas?buscar=${encodeURIComponent(value)}`
        : "/admin/entradas",
      { scroll: false },
    );
  };

  return (
    <form
      method="get"
      onSubmit={buscarAhora}
      className="card-surface p-6"
    >
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <div className="min-w-0">
          <label htmlFor="buscar" className="label">
            Buscar reserva o cliente
          </label>

          <div className="relative mt-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              id="buscar"
              name="buscar"
              type="search"
              className="field pl-10"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Ej. ORB-000123, 123 o Ana López"
              autoComplete="off"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <button type="submit" className="btn-primary">
            Buscar
          </button>
          {initialSearch.trim() && (
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setSearch("");
                router.replace("/admin/entradas", { scroll: false });
              }}
            >
              Limpiar
            </button>
          )}
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Los resultados se actualizan mientras escribes. Puedes buscar por
        nombre o por número de reserva, con o sin el prefijo ORB.
      </p>
    </form>
  );
}
