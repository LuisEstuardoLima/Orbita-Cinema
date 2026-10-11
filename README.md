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
5. `/admin/peliculas` registra (con póster), lista y activa/desactiva películas mediante Server Actions.

> Hasta el Sprint 2 (login) el panel admin no tiene autenticación: no lo desplieguen públicamente con `AUTH_GUARD=off`.

`AUTH_GUARD=off` (por defecto) deja navegar `/perfil` y `/admin/*` mientras la autenticación real no esté lista. Con `AUTH_GUARD=on`, `src/middleware.ts` exige sesión y rol. La fuente única del rol es la BD (`public.usuarios.id_rol` → `public.rol`, ver `supabase/sprint2-auth.sql`): `getRol()` consulta por request y devuelve `Cliente` | `Colaborador` | `Administrador`. El rol NO se lee del JWT ni de metadata editable por el usuario.

## Sprint 2 · SCRUM-111 Gestión de funciones

1. En Supabase > SQL Editor ejecutar `supabase/sprint2-funciones.sql` (después de `sprint1.sql`). Asegura `pelicula.duracion_min` (no la cambia si ya existe), completa la duración de las 6 películas de prueba que no la tengan y crea un índice para validar cruces. Es idempotente.
2. `/admin/funciones` (Administrador y Colaborador, módulo "Funciones" del panel) lista las funciones desde hoy, filtra por fecha y película, y crea, modifica y cancela funciones con Server Actions (`assertRol` en `lib/auth/guard.ts`).
3. Cancelar es una baja lógica (`funcion.activa = false`). Pendiente del Sprint 3: impedir editar o cancelar funciones con reservas (hay un `TODO` en `actions.ts`).
4. La duración se captura en el formulario de películas (SCRUM-108). Una película sin `duracion_min` (null) se trata como de 120 minutos al calcular cruces.

### Cruce de horarios

Una función ocupa su sala en el intervalo `[inicio, inicio + duracion_min + 15 min)` (15 min de limpieza). No se registra si se traslapa con otra función **activa** de la misma sala. Se compara en minutos absolutos (fecha + hora), así que también detecta cruces con funciones que pasan de medianoche; por eso la consulta revisa el día anterior y el siguiente (`buscarCruce` en `lib/db/funciones.ts`). La validación es solo del servidor.

**Límite conocido:** es una validación de aplicación, no de la base. Si dos personas guardan exactamente al mismo tiempo funciones que se cruzan, ambas pueden pasar. Tampoco se revalidan las funciones ya programadas si después se cambia la duración de su película.

**Mejora futura (alternativa B):** guardar el fin de cada función en `funcion` (p. ej. `inicio`/`fin` como `timestamp` calculados al crear) y agregar en Postgres una restricción de exclusión por sala (`create extension btree_gist` + `exclude using gist (id_sala with =, tsrange(inicio, fin) with &&) where (activa)`). La base rechazaría los traslapes aunque lleguen al mismo tiempo, y cambiar la duración de una película no movería las funciones ya programadas.

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
│  ├─ admin/funciones/           # Gestión de funciones, Administrador y Colaborador (SCRUM-111)
│  └─ api/                       # (por crear) Route Handlers: bloqueo de asientos, pago, boleto, correo
├─ components/
│  ├─ cinema/                    # SiteHeader, Modal, FunctionHeader
│  └─ ui/                        # shadcn/ui
├─ lib/
│  ├─ db/cartelera.ts            # consultas a Supabase (cartelera, detalle, listado admin)
│  ├─ db/funciones.ts            # consultas de /admin/funciones y validación de cruces
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

## Decisiones sobre la baja de películas (leer antes de Sprint 3/4 y 7)

Estas decisiones ya están tomadas. No volver a abrirlas sin revisarlas.

**No existe borrado real de una película.** El panel solo tiene un interruptor que activa y desactiva. Quien eliminaba con el 🗑 idéntico a desactivar y además ocultaba la película del panel, dejándola irrecuperable desde la aplicación (había que volver a crearla, y quedaba el duplicado con el slug `-2`).

- La baja es lógica: `pelicula.activa = false`. La fila nunca se borra.
- `listPeliculasAdmin()` trae **también** las inactivas, ordenando las activas primero. Si algún día se vuelve a filtrar por `activa = true`, se pierde esta capacidad y vuelve el problema.
- Editar (SCRUM-67, Sprint 7) tiene que funcionar **igual sobre una película activa o inactiva**; no debe exigir reactivarla antes.

**Al desactivar no se tocan las reservas ni los boletos ya emitidos.** Un boleto vendido es una promesa: la baja solo impide vender *nuevas* entradas, nunca invalida las anteriores.

**Eliminar apaga las funciones de la película en cascada.** `eliminarPelicula` pone `funcion.activa = false` en todas las funciones de la película antes de marcar `eliminada = true`. Nunca es un DELETE: las filas se conservan por auditoría (se recuperan con `select * from funcion where id_pelicula = X`) y para no invalidar reservas o boletos ya emitidos. El orden de las escrituras es funciones → película, para que un fallo deje la película reintentable en el panel. Reactivar la película más adelante NO reactiva sus funciones automáticamente.

**Cuando exista el flujo de compra hay que validar `activa` al escribir, no solo al leer.** Ocultar la película de la cartelera no basta: alguien puede tener la pantalla de pago abierta cuando el admin la desactiva. Al crear la reserva y al confirmar el pago hay que releer `pelicula.activa` **y** `funcion.activa` contra la base y rechazar con un mensaje claro si ya no está disponible. El interruptor de Estado (desactivar) no apaga las funciones en cascada: al reactivar la película, sus funciones siguen ahí. Por eso hay que releer las dos. En cambio, el botón Eliminar sí las apaga todas (ver arriba).

**Registrar una película con el título de una que ya está activa se rechaza** (`crearPelicula`). Una película dada de baja sí admite una nueva con el mismo título, porque el objetivo es activar la existente.

**Editar el título y el slug.** El `slug` se genera solo al crear y es la URL pública (`/pelicula/[slug]`). Si el Sprint 7 permite cambiar el título, hay que decidir si el `slug` se recalcula: hacerlo sin más rompe los enlaces ya compartidos.

## Optimización (pendiente, priorizado)

Puntos detectados revisando el proyecto. Están anotados para retomarlos, **no son urgent**: hoy `pelicula` tiene 8 filas, `funcion` 88 y `sala` 6, así que nada de esto se nota todavía. Se anotan porque el coste crece con el tamaño de los datos.

### 1. Los pósters no pasan por el optimizador de Next.js — el más visible

`src/components/cinema/PosterImage.tsx` termina con:

```tsx
unoptimized={!src.startsWith("/")}
```

Los pósters de Supabase son URLs remotas (`https://…supabase.co/...`), no empiezan con `/`, así que **todas caen en `unoptimized = true`** y el navegador descarga el JPG original sin redimensionar. En la cartelera son 6 pósteres de ~500 KB cada uno: alrededor de **3 MB por visita** para mostrar miniaturas.

**Por qué está así:** el comentario del código explica que es para no registrar el dominio en `next.config.ts`. Es un trade-off legítimo.

**Cómo se resolvería:** registrar el dominio de Supabase en `images.remotePatterns` de `next.config.ts` y quitar el `unoptimized`, de modo que los posters se sirvan redimensionados y en WebP. Antes de hacerlo hay que **medir el tamaño real de los JPG** y confirmar que el optimizador de Next (que en Vercel tiene límites) da mejor resultado que la URL directa.

### 2. Falta el índice compuesto de `funcion` — el más escalable

`getCartelera()` (la ruta más golpeada del sitio) consulta:

```ts
supabase.from("funcion").select("*")
  .eq("activa", true).gte("fecha", ahora.fecha).order("fecha").order("hora");
```

Sin un índice que cubra ese filtro, Postgres hace *seq scan* (recorre la tabla entera) en **cada visita**. Con las ~90 funciones actuales es instantáneo; con 50 películas × 30 funciones × 7 días serían unas 10 000 filas.

**Ya está resuelto en `supabase/sprint1.sql` (punto 6):** dos índices compuestos, uno para la cartelera y otro para el detalle de película. Son idempotentes, se aplican corriendo el script.

> Cuando se defina el módulo de funciones, **revisar si el índice sigue siendo el adecuado**: si el filtrado real termina siendo por `id_sala` u otro criterio, puede hacer falta otro o cambiar el orden de las columnas.

### 3. `select("*")` innecesario

Las consultas de `cartelera.ts` piden todas las columnas, pero el código solo usa algunas. Nombrarlas explícitamente reduce el peso de los datos que cruzan la red en cada request y mejora el tipado si más adelante se generan los tipos con `supabase gen types`. **No es urgente**, es buena práctica.

### 4. Cache del detalle de película

`getCartelera()` es `force-dynamic`, lo cual es correcto porque depende de la fecha y hora actuales. Pero `getPeliculaBySlug()` solo usa `cache()` de React, que **deduplica dentro de un mismo render, no entre peticiones**: recargar la página vuelve a consultar la base.

Cuando se conecte el flujo de compra el usuario va a recargar el detalle varias veces seguidas. Ahí conviene revisar un `revalidate` con *tags* de Next, o `unstable_cache` con una invalidación explícita desde las Server Actions.

**Dejar para cuando exista el flujo de compra**, para no cachear de más una pantalla que aún cambia.
