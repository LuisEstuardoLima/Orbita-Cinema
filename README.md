# Órbita Cinema

Sistema web de reservación de entradas de cine (Universidad Galileo – Práctica del Desarrollo de Software I).

**Stack (según la documentación final):** Next.js (App Router) + React · Tailwind CSS v4 + shadcn/ui · Supabase (PostgreSQL + Auth) · Vercel · `pdf-lib` + `qrcode` para el boleto · servicio de correo transaccional (Resend o Nodemailer, por definir).

## Puesta en marcha

```bash
bun install
cp .env.example .env.local   # completar con las llaves de Supabase
bun run dev                  # http://localhost:3000
```

Next.js se sigue ejecutando con Node (v20+); Bun se usa como gestor de paquetes y para correr los scripts.

## Sprint 1 (SCRUM-11 a 17, 101, 103, 104, 106)

1. En Supabase > SQL Editor ejecutar `supabase/sprint1.sql` (columnas nuevas, políticas RLS de lectura, bucket `posters`). Es idempotente.
2. Completar `.env.local` (incluye `SUPABASE_SERVICE_ROLE_KEY`, solo servidor).
3. `/` lee `pelicula`, `funcion` y `sala` de Supabase; filtros por fecha, rango horario, idioma y clasificación.
4. `/pelicula/[slug]` muestra las funciones por fecha y sala.
5. `/admin/peliculas` registra (con póster), lista y da de baja películas (`activa = false`) mediante Server Actions.

> Hasta el Sprint 2 (login) el panel admin no tiene autenticación: no lo desplieguen públicamente con `AUTH_GUARD=off`.

`AUTH_GUARD=off` (por defecto) deja navegar `/perfil` y `/admin/*` mientras la autenticación real no esté lista. Con `AUTH_GUARD=on`, `src/middleware.ts` exige sesión y rol (`app_metadata.rol` = `Cliente` | `Colaborador` | `Administrador`).

## Estructura

```
src/
├─ app/                          # Frontend + rutas (App Router)
│  ├─ layout.tsx, globals.css    # shell, fuentes (next/font), design system
│  ├─ page.tsx                   # Cartelera  (cartelera-client.tsx = filtros/estado)
│  ├─ pelicula/[slug]/           # Detalle, salas y horarios
│  ├─ entradas/                  # Cantidad y tipo de entrada (máx. 10)
│  ├─ asientos/                  # Mapa interactivo de butacas
│  ├─ pago/                      # Pasarela prototipo (recargo 5 %)
│  ├─ login/, perfil/            # Cuenta de cliente
│  ├─ admin/peliculas/           # Panel Administrador (page + client + actions.ts), sin enlace en la navegación (RNF-015)
│  └─ api/                       # (por crear) Route Handlers: bloqueo de asientos, pago, boleto, correo
├─ components/
│  ├─ cinema/                    # SiteHeader, Modal, FunctionHeader
│  └─ ui/                        # shadcn/ui
├─ lib/
│  ├─ db/cartelera.ts            # consultas a Supabase (cartelera, detalle, listado admin)
│  ├─ cartelera.ts               # tipos y filtros puros (servidor y cliente)
│  ├─ cinema-data.ts             # datos estáticos: solo los usan entradas/asientos/pago (sprints siguientes)
│  ├─ search-params.ts           # parseo/armado del query string del flujo de compra
│  ├─ roles.ts                   # roles del sistema
│  └─ supabase/{client,server}.ts
└─ middleware.ts                 # control de acceso por rol
public/posters/                  # pósters (antes venían de *.asset.json de Lovable)
```

Cada pantalla con estado se divide en `page.tsx` (Server Component: `metadata` y lectura de `searchParams`) y `*-client.tsx` (`"use client"`: la UI original de Lovable).

## Equivalencias TanStack Start → Next.js

| TanStack Start | Next.js |
| --- | --- |
| `routes/index.tsx` | `app/page.tsx` |
| `routes/pelicula.$slug.tsx` | `app/pelicula/[slug]/page.tsx` |
| `routes/admin.peliculas.tsx` | `app/admin/peliculas/page.tsx` |
| `createFileRoute().head()` | `export const metadata` / `generateMetadata` |
| `validateSearch` + `Route.useSearch()` | `searchParams` (async) + `lib/search-params.ts` |
| `<Link to=… search=…>` | `next/link` con `href={toHref(…)}` |
| `__root.tsx` (shell, 404, error) | `layout.tsx`, `not-found.tsx`, `error.tsx` |
| `<img>` | `next/image` |
| Google Fonts por `<link>` | `next/font/google` |
| `@tailwindcss/vite` | `@tailwindcss/postcss` |

Se eliminó lo específico de Lovable/Vite/Nitro (`server.ts`, `start.ts`, `router.tsx`, `routeTree.gen.ts`, reporte de errores de Lovable, `vite.config.ts`, `bunfig.toml`, `@tanstack/*`).

## Pendiente (según la documentación)

`entradas`, `asientos` y `pago` siguen con datos estáticos de `cinema-data.ts` (sprints 3 y 4), así que al pulsar "Continuar" desde una película de la base de datos esas pantallas todavía muestran el encabezado de prueba. Faltan además: tablas `asiento`, `reserva`, `detalle_reserva`, `pago` y `boleto`, bloqueo temporal de 5 min, boleto PDF + QR, correo de confirmación, login/roles y los paneles de Colaborador y Administrador restantes.
