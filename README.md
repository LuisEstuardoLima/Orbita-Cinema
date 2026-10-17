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

## Control de acceso por rol (SCRUM-116)

La matriz de permisos vive en **`src/lib/permisos.ts`** (única fuente de verdad):

| Zona / módulo | Cliente | Colaborador | Administrador |
|---|:-:|:-:|:-:|
| Sitio público, compra, `/perfil` | ✔ | ✔ | ✔ |
| `/admin` (inicio del panel) | | ✔ | ✔ |
| `/admin/funciones` | | ✔ | ✔ |
| `/admin/peliculas` | | consulta | ✔ |
| `/admin/salas` (y asientos) | | consulta | ✔ |

**Consulta** = el Colaborador entra y ve la información (listado de películas, salas y plano de asientos), pero no ve los botones de crear, editar, dar de baja, eliminar ni activar/desactivar, y el plano de asientos no se puede modificar. Es solo la parte visual (`esSoloLectura` / `puedeModificar` en `lib/permisos.ts`); quien rechaza de verdad es el servidor: las acciones de películas y salas siguen exigiendo Administrador.

Se aplica en cuatro capas, todas con la misma matriz y el rol leído de la BD (`usuarios.id_rol`), nunca del navegador:
1. **Middleware** (`src/middleware.ts`): sin sesión → `/login?next=...`; con sesión sin permiso → `/acceso-denegado`.
2. **Páginas del panel** (`exigirRol` en `lib/auth/pagina.ts`): segunda barrera en el servidor.
3. **Server Actions** (`assertAdmin` / `assertRol`): rechazan la acción aunque se invoque sin pasar por la pantalla.
4. **Base de datos**: RLS activo; las tablas solo tienen políticas de lectura pública (películas, salas y funciones activas) y toda escritura administrativa pasa por la service role desde el servidor. El usuario no puede escribir su propio `id_rol`.

El menú y las tarjetas de `/admin` se filtran por rol, y el encabezado muestra nombre y rol. Todo requiere `AUTH_GUARD=on` (con `off` no se valida nada: solo para desarrollo sin login). Para proteger un módulo nuevo: agregar su regla en `REGLAS_RUTA` (antes de `/admin`) y su entrada en `lib/admin-modulos.ts`.

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

`entradas`, `asientos` y `pago` siguen con datos estáticos de `cinema-data.ts` (sprints 3 y 4), así que al pulsar "Continuar" desde una película de la base de datos esas pantallas todavía muestran el encabezado de prueba. Faltan además: tablas `reserva`, `detalle_reserva`, `pago` y `boleto`, bloqueo temporal de 5 min, boleto PDF + QR, correo de confirmación, login/roles y los paneles de Colaborador y Administrador restantes. (La tabla `asiento` —plano físico por sala— ya existe desde SCRUM-110; ver "Configuración de asientos" más abajo.)

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

## Configuración de asientos (SCRUM-110)

**`asiento` es el plano FÍSICO de cada sala, no la venta.** Cada fila es un espacio de la sala (`fila` A..Z, `numero`, `estado`). El `estado` describe la naturaleza del espacio, no si está vendido:

- `normal` = asiento real que se puede vender.
- `pasillo` = pasillo, nunca es asiento.
- `deshabilitado` = posición bloqueada o rota, no se vende.

Un asiento **pertenece a la sala** (`id_sala` → `sala`), **no a una función**: es el mismo plano para todas las funciones de esa sala. (Esto corrige el diagrama ER inicial, donde `asiento` apuntaba a `funcion`.)

**La capacidad se deriva de la distribución.** Cuando una sala ya tiene plano, `sala.capacidad` se recalcula sola como la cantidad de asientos `normal` (los pasillos y deshabilitados no cuentan) y el campo del formulario queda en solo lectura. Mientras la sala no tenga plano, la capacidad sigue siendo la que se escribe a mano.

**No se re-configura el plano si la sala tiene funciones activas.** Guardar la distribución hace borrado + reinserción de todo el plano; hacerlo con una función futura activa podría mover o pasillizar un asiento ya implicado. El configurador queda en solo lectura con un aviso. (Es la versión actual de "ya tiene reservas" del ticket; cuando exista `reserva` se refina a "funciones con reservas".)

## Bloqueo temporal de asientos (SCRUM-119)

Al presionar **Continuar** en `/asientos`, los asientos elegidos quedan bloqueados 5 minutos a nombre de ese cliente. **Antes de usarlo hay que ejecutar una vez `supabase/sprint3-bloqueo-asientos.sql` en el SQL Editor de Supabase** (agrega `reserva.token_sesion`, un índice único parcial y cinco funciones; es idempotente). Sin ese script, "Continuar" muestra un error.

- **Tablas:** usa las que ya existen. El bloqueo es una `reserva` en `pendiente_pago` (su `fecha_expiracion` es `now() + 5 min`) con un `detalle_reserva` en `bloqueado` por asiento. Los tipos de entrada se traducen a los valores de la BD (`tercera` → `tercera_edad`, `ninos` → `nino`; `lib/bloqueo.ts`).
- **Dueño del bloqueo:** una cookie `httpOnly` (`orbita_bloqueo`, un uuid aleatorio) que crea el servidor y se guarda en `reserva.token_sesion`. Vale para cliente registrado e invitado; nunca se confía en un id que venga de la URL.
- **Sin carreras:** `bloquear_asientos` hace todo en una transacción y el índice único `(id_funcion, id_asiento)` sobre `bloqueado/reservado` impide que dos clientes tomen el mismo asiento; si otro se adelantó, el cliente recibe un aviso y el mapa se recarga.
- **Otros clientes:** `asientos_no_disponibles` cuenta como ocupados los reservados y los bloqueos que todavía no vencen. Un bloqueo vencido **no cuenta**, así que los asientos quedan libres a la hora exacta sin depender de ningún proceso. La próxima compra de esa función, o `liberar_bloqueos_vencidos()`, además marca la reserva como `expirada` (al final del script hay un `pg_cron` opcional para correrla cada minuto).
- **Contador y vencimiento:** `/pago` solo abre con un bloqueo vigente de ese navegador y muestra un contador regresivo (los segundos los calcula la BD). Al llegar a cero, o si se intenta **Pagar** con el bloqueo vencido, avisa y regresa a `/asientos?vencido=1`.
- **Regresar o cancelar:** "Cambiar asientos" y "Cancelar compra" en `/pago`, y volver a `/asientos`, llaman a `liberar_bloqueo` y los asientos se liberan al instante.
- **Pendiente para SCRUM-123/124/125:** mientras el comprador invitado no capture sus datos, la reserva guarda `Invitado (pendiente)` / `pendiente@invitado.invalid` (la BD exige nombre y correo no vacíos). Al pagar hay que actualizarlos y pasar `reserva.estado` a `confirmada` y `detalle_reserva.estado` a `reservado`. El pago actual (`/pago`) sigue siendo un prototipo.

## Ocupación en tiempo real y doble reserva (SCRUM-120)

No requiere script SQL nuevo: se apoya en lo de SCRUM-119 (`supabase/sprint3-bloqueo-asientos.sql`).

- **Mapa en vivo:** mientras `/asientos` está abierto, el cliente consulta cada 3 segundos la acción de servidor `consultarOcupacion` (y también al volver a la pestaña). Un asiento que otro cliente bloquea o reserva pasa a "Ocupado" sin recargar; si su bloqueo vence, vuelve a verse libre, porque la BD compara con su propio reloj. Se eligió sondeo y no Supabase Realtime a propósito: `detalle_reserva` no es legible con la clave pública, y abrirla solo para esto expondría datos de compras. La acción devuelve únicamente ids de asiento.
- **Selección afectada:** si otro cliente toma un asiento que yo tenía elegido, se quita de mi selección y aparece un aviso para elegir otro.
- **Doble reserva:** el índice único parcial `uq_detalle_reserva_asiento_funcion_activo` (`id_funcion`, `id_asiento` donde el detalle está `bloqueado` o `reservado`) hace que la BD rechace un segundo registro sobre el mismo asiento, aunque falle cualquier validación de la aplicación. Si dos clientes pulsan **Continuar** a la vez, `bloquear_asientos` deja pasar solo a uno; el otro recibe "Alguno de los asientos acaba de ser tomado" y el mapa se actualiza al instante.

## Capa de venta `reserva` — para el Sprint 3 (aún no existe)

Anotado aquí para retomarlo, **sin crear la tabla todavía** porque sus reglas aún no están definidas.

La disponibilidad real de un show **no se guarda en `asiento`**: se calcula restando. Para una función concreta:

```
disponibles = asientos de la sala con estado 'normal'
              MENOS los que ya figuran en `reserva` de esa función
```

Antes de crear `reserva` hay dos cosas abiertas que aclarar con el ingeniero (ya se conversaron, quedan pendientes de confirmar):

1. **El timing de compra / bloqueo temporal** (los ~5 min que separa "reservado" de "pagado"): cuánto dura una reserva y qué pasa si vence.
2. **Qué ocurre si el admin desactiva la película o la función mientras alguien está pagando.** Hoy `pelicula.activa` / `funcion.activa` solo controlan la cartelera; cuando exista el flujo de compra hay que releer ambos al crear la reserva y al confirmar el pago (ver la nota de películas más arriba).

La tabla tendrá al menos `id_funcion`, el `id_asiento` estable (el de la tabla física) y un `estado` de venta (`reservado | vendido | libre`), con un único `(id_funcion, id_asiento)` para no vender dos veces el mismo asiento en el mismo show. El detalle fino (`detalle_reserva`, `pago`, `boleto`) pertenece a los sprints 3 y 4.

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
