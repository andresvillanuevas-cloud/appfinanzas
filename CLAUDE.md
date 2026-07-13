# CLAUDE.md — App de Finanzas Personales "MiCuadra" (PWA + Supabase)

## Contexto del proyecto

Réplica funcional y personalizada de la app chilena "Cuadra tus finanzas" (iOS), construida como **PWA instalable en iPhone**. El dueño del proyecto (Andrés, analista senior de control de gestión) validó la lógica completa en un prototipo React de un solo archivo (`cuadra.jsx`, incluido en este repo como referencia). Ese prototipo es la **fuente de verdad de UI y reglas de negocio**: replicar su comportamiento, no reinventarlo.

- Moneda única: **CLP** (sin decimales, separador de miles con punto: `$1.234.567`).
- Idioma UI: español de Chile.
- Modo oscuro por defecto (paleta abajo). Modo claro en fase posterior.
- Usuario objetivo inicial: 1 persona (el dueño). Multi-usuario preparado desde el esquema pero sin UI de equipos.

## Stack (no cambiar sin justificación)

- **Frontend**: React 18 + Vite, JavaScript (no TypeScript en v1 para velocidad; migrable después). CSS-in-JS simple o CSS modules — sin Tailwind ni UI kits pesados.
- **Backend**: Supabase (Postgres + Auth email/password + Row Level Security).
- **PWA**: manifest + service worker (vite-plugin-pwa). Offline-first NO requerido en v1; solo cache de shell.
- **Deploy**: Vercel (frontend) + Supabase cloud (free tier).

## REGLAS DE NEGOCIO — INNEGOCIABLES

Estas reglas son el corazón de la app. Cualquier feature que las viole está mal aunque "funcione". Escribir tests para cada una.

1. **Saldo de cuenta** = saldo inicial + Σ movimientos confirmados/cuadrados de esa cuenta. Los movimientos `pendiente` NUNCA tocan saldo.
2. **Gasto** reduce dinero de una cuenta y consume presupuesto de una categoría en su mes.
3. **Transferencia** mueve dinero entre cuentas. NO es gasto. NO consume presupuesto.
4. **Compra con tarjeta de crédito (TC)** genera N cuotas (`cuotaTC`), una por mes. Cada cuota consume presupuesto de la categoría EN SU MES y aumenta el "por facturar" de la tarjeta. NO toca dinero real al registrarse.
5. **Pago de tarjeta** mueve dinero real desde una cuenta origen y reduce el "por facturar". NO es gasto (la compra ya fue gasto vía cuotas). Regla anti-duplicación central.
6. **Pago de crédito** ídem: reduce deuda pendiente, mueve dinero real, NO es gasto.
7. **Cupo de tarjeta ≠ dinero real.** Patrimonio = Σ saldos de cuentas de dinero − deudas de créditos − líneas usadas. El cupo nunca suma al patrimonio.
8. **Línea de crédito bancaria**: una cuenta de banco puede tener `line`. El saldo puede quedar negativo hasta `-line` (línea usada). Pagar TC/crédito PUEDE usar línea (con aviso). Pagar la línea usada SOLO acepta dinero real de otra cuenta (nunca línea con línea).
9. **Compra en curso** (deuda preexistente): al registrarla se indica "próxima cuota a facturar X de N"; se crean solo las cuotas X..N hacia el futuro. El remanente de redondeo va en la primera cuota creada.
10. **Pulso** (conciliación): compara saldo esperado vs real por cuenta. La diferencia SIEMPRE se registra como movimiento trazable (gasto/ingreso con estado `cuadrado`), nunca como ajuste silencioso del saldo.
11. **Programados**: vista futura. NO tocan saldos hasta que el usuario los confirma explícitamente.

## Modelo de datos (Supabase)

```sql
-- users: manejado por Supabase Auth
accounts (
  id uuid pk, user_id uuid fk, name text, type text, -- efectivo|banco|ahorro|tarjeta|credito|inversion
  color text, initial bigint default 0,
  line bigint default 0,          -- banco: línea de crédito
  cupo bigint default 0,          -- tarjeta: cupo total
  cierre int, venc int,           -- tarjeta: día cierre / día vencimiento
  cuota_value bigint, cuotas_restantes int, pago_dia int, venc_month text, -- credito
  created_at timestamptz default now()
)
categories (
  id uuid pk, user_id uuid fk, name text, type text, -- gasto|ingreso
  prioridad text, -- obligaciones|necesidades|gustos
  icon text, color text
)
movements (
  id uuid pk, user_id uuid fk, kind text,
  -- kind: gasto|ingreso|transferencia|cuotaTC|pagoTarjeta|pagoCredito|pagoLinea
  amount bigint not null, month text not null, -- 'YYYY-MM'
  status text default 'confirmado', -- pendiente|confirmado|cuadrado
  merchant text, note text,
  account_id uuid, from_id uuid, to_id uuid,       -- según kind
  card_id uuid, credit_id uuid, bank_id uuid,       -- pagos
  category_id uuid,
  cuota_index int, cuotas_total int, purchase_group uuid, -- cuotas TC (mismo grupo = misma compra)
  ts timestamptz default now()
)
budgets ( id uuid pk, user_id uuid fk, month text, category_id uuid, amount bigint, unique(user_id, month, category_id) )
scheduled ( id uuid pk, user_id uuid fk, name text, kind text, amount bigint, account_id uuid, day int )
```

RLS en TODAS las tablas: `user_id = auth.uid()`. Sin excepciones.

## Paleta y estilo (del prototipo — respetar)

```
bg #05070a · card #141920 · card2 #1b222c · line #232b36
teal #1a8a6f (primario) · green #2ecc8f (ingreso/ok) · red #ef5b6e (gasto)
orange #e08b3e (deuda/alerta) · blue #3f7fe0 (info/cierre) · violet #6c5ce7 (bancos)
txt #f2f5f8 · sub #8b95a3
```
Tarjetas radio 16–24px, hero con degradado teal→blue, tab bar inferior 5 secciones (Inicio · Presupuesto · Movimientos · Cuentas · Más), FAB radial con: Registro rápido, Programados, Gasto TC, Pago TC, Pago crédito, Pago línea. Tipografía system (-apple-system). Montos grandes en 800 weight.

---

# FASES DE CONSTRUCCIÓN

Trabajar fase por fase. **No avanzar de fase sin cumplir sus criterios de aceptación.** Al terminar cada fase: correr tests, commit con mensaje `fase-N: descripción`.

## FASE 0 — Setup (½ día)
- Vite + React + vite-plugin-pwa, estructura `/src/{components,screens,lib,engine}`.
- Proyecto Supabase: correr migración SQL del modelo de datos + políticas RLS.
- Cliente supabase en `/src/lib/supabase.js` con env vars (`.env.local`, nunca commitear claves).
- Auth mínima: pantalla login/registro email+password, sesión persistente, logout en "Más".
- **Aceptación**: registro, login, logout funcionan; tablas creadas; RLS verificada (un usuario no ve datos de otro).

## FASE 1 — Motor contable puro (1 día) ⭐ LA MÁS IMPORTANTE
- Portar el motor del prototipo a `/src/engine/engine.js` como **funciones puras sin React**: `computeBalances(accounts, movements)` → `{ bal, debt, cardUsed, lineUsed, avail, patrimonio, totalDinero }`.
- Portar `registerCardPurchase` (con `startIndex` para compras en curso, remanente en primera cuota creada), y helpers de meses (`monthKey`, `addMonths`).
- **Tests (vitest) obligatorios**, uno por regla de negocio 1–11. Casos mínimos: gasto baja saldo; pendiente no baja saldo; transferencia no es gasto; compra 3 cuotas genera 3 movimientos en meses consecutivos; pago TC baja cardUsed y saldo origen sin crear gasto; pago con línea deja saldo negativo hasta -line y no más; pago de línea rechaza origen sin saldo real; compra en curso 4/12 crea 9 cuotas; remanente de $5.000/3 = 1.667+1.667+1.666.
- **Aceptación**: 100% de tests verdes. El motor no importa nada de React ni Supabase.

## FASE 2 — CRUD base + pantallas Cuentas y Movimientos (2 días)
- Hooks de datos (`useAccounts`, `useMovements`, `useCategories`) contra Supabase, con estado local optimista.
- Pantalla **Cuentas**: hero patrimonio, grupos (Dinero y ahorro / Tarjetas / Créditos), crear cuenta con los 6 tipos y campos condicionales del prototipo (incl. día pago + próximo vencimiento en créditos), detalle de cuenta (cupo con barra de uso, línea disp./usada, vencimientos, historial, eliminar solo si no tiene movimientos).
- Pantalla **Movimientos**: buscador, filtro Todo/Este mes/Futuros, filas con estados.
- **Aceptación**: crear las cuentas reales del dueño (bancos, TCs, crédito) y ver saldos correctos tras recargar la página (persistencia real).

## FASE 3 — Registro de movimientos (2 días)
- **Registro rápido** con parser NLP simple ("Uber 8.500" → monto+comercio) y aviso si no hay cuentas de dinero (derivar a crear cuenta o a Gasto TC).
- **Gasto TC** completo: cupo en vivo, selector cuotas 1–36 + stepper, primera cuota ahora/diferida, bloque "¿compra ya en curso?" con próxima cuota X/N, preview "cuotas por venir", validación contra cupo usando monto restante.
- **Pago TC / Pago crédito**: origen con `avail` (saldo real + línea), aviso azul al usar línea, bloqueo solo si excede saldo+línea.
- **Pago línea**: solo bancos con saldo negativo, solo origen con dinero real.
- **Transferencias** entre cuentas.
- **Aceptación**: reproducir el escenario real del dueño (deuda TC en curso, pago con línea, pago de línea) y que Inicio/Cuentas cuadren con sus cartolas.

## FASE 4 — Inicio, Presupuesto, Pulso, Programados (2 días)
- **Inicio**: hero Disponible del mes (toggle Mes/Total), Esperado/Patrimonio, ingresos/gastos del mes, carruseles Dinero y Deudas y cupos (con línea disp./usada, vence X), últimos movimientos, acceso a Pulso.
- **Presupuesto**: asignación por categoría/mes, gastado vs asignado (cuotas TC cuentan en su mes), agrupación por prioridad (Obligaciones/Necesidades/Gustos), navegación de meses.
- **Categorías**: CRUD con tipo, prioridad, ícono, color.
- **Pulso**: wizard cuenta por cuenta esperado vs real; diferencia → movimiento `cuadrado`.
- **Programados**: lista + confirmar (recién ahí impacta saldo).
- **Aceptación**: flujo diario completo usable solo desde el teléfono (PWA instalada).

## FASE 5 — Export, PWA y pulido (1 día)
- Export CSV (UTF-8 BOM, todos los kinds incluyendo pagoLinea con signo correcto) y XLSX si es trivial (SheetJS).
- Manifest + íconos + splash; instalable en iPhone (Add to Home Screen); título y theme-color correctos.
- Toasts, estados vacíos con CTA, loading skeletons básicos.
- **Aceptación**: Lighthouse PWA instalable; CSV abre bien en Excel con tildes.

## FASE 6 — Backlog (NO construir aún, solo dejar preparado)
- Modo claro con toggle. Widgets/atajos iOS. Historial de cuotas ya pagadas de compras en curso. Reglas recurrentes con rrule real. Multi-moneda. Gráficos de tendencia. Compartir cuenta con pareja.

## Estado

### Fase 0 — Setup: COMPLETA (2026-07-09)
- Repo git inicializado en `App finanzas/`.
- Vite + React (JS) + vite-plugin-pwa scaffolded, estructura `/src/{components,screens,lib,engine}` creada.
- Cliente Supabase en `src/lib/supabase.js`, env vars vía `.env.local` (no versionado; ejemplo en `.env.local.example`).
- Migración SQL del modelo de datos completo (`accounts`, `categories`, `movements`, `budgets`, `scheduled`) + políticas RLS en `supabase/migrations/0001_init.sql`, corrida contra el proyecto Supabase real.
- Auth mínima: `src/screens/Auth.jsx` (login/registro email+password), sesión persistente (`supabase.auth`), logout en `src/screens/Mas.jsx`.
- Shell de navegación (`src/App.jsx`) con tab bar (Inicio/Presupuesto/Movimientos/Cuentas/Más) — pantallas reales pendientes para Fase 2+.
- **Verificado end-to-end en navegador**: registro, login, logout, persistencia de sesión tras reload, y aislamiento RLS confirmado con dos usuarios reales (uno no ve ni puede borrar filas del otro).
- Nota de entorno: el proyecto Supabase tiene confirmación de email activada por defecto y el envío de emails (SMTP default) tiene rate limit muy bajo; para pruebas se crearon usuarios directamente desde el dashboard con "Auto Confirm User". Recomendado desactivar "Confirm email" en Authentication → Providers → Email dado que es una app de un solo usuario.
- Pendiente: `dev.cmd` en la raíz del proyecto es un wrapper para levantar el server desde el preview tool (PATH de Node no disponible por defecto en esta máquina) — no es parte del build de producción.

### Fase 1 — Motor contable puro: COMPLETA (2026-07-09)
- Motor portado a `src/engine/engine.js` como funciones puras (cero imports — ni React ni Supabase): `computeBalances(accounts, movements)` → `{ bal, debt, cardUsed, lineUsed, avail, patrimonio, totalDinero }`, `computeMonthStats`, `registerCardPurchase` (con `startIndex` y remanente en primera cuota creada), constructores de pagos (`buildCardPayment`/`buildCreditPayment`/`buildLinePayment`), validadores (`validateDebtPayment`, `validateLinePayment`), `buildPulseAdjustment`, `confirmScheduled`, helpers `monthKey`/`addMonths`/`todayKey`.
- 27 tests vitest en `src/engine/engine.test.js`, uno o más por regla de negocio 1–11 + escenario de integración del dueño (deuda TC en curso → pago con línea → pago de línea). 100% verdes (`npm test`).
- **Desviación deliberada del prototipo**: `registerCardPurchase` usa `round` en vez de `floor` para la cuota base, porque el caso de aceptación de Fase 1 exige 5.000/3 = 1.667+1.667+1.666 (el prototipo daba 1.668+1.666+1.666). El ajuste de redondeo (±) sigue cayendo en la primera cuota creada.
- Semántica heredada del prototipo a tener presente en la UI: `avail` puede ser negativo cuando la línea está agotada (avail = saldo + línea libre); los validadores ya lo manejan.

### Fase 2 — CRUD base + Cuentas y Movimientos: COMPLETA (2026-07-09)
- Hooks de datos en `src/lib/useData.js` (`useAccounts`/`useMovements`/`useCategories`): mapeo snake_case (DB) ↔ camelCase (motor/UI), inserts/deletes optimistas con revert + toast si Supabase falla. Los ids se generan en cliente con `crypto.randomUUID()` (el `uid()` del motor ahora emite UUID v4 válidos para Postgres).
- Primitivas UI en `src/components/ui.jsx` (Card, Empty, Sheet, Field, MovRow, MonthNav, etc.). Los SF Symbols de iOS del prototipo se reemplazaron por emoji/unicode (no renderizan fuera de Apple).
- `src/screens/Cuentas.jsx`: hero patrimonio, grupos Dinero/Tarjetas/Créditos. `src/components/AccountModals.jsx`: NewAccount (6 tipos con campos condicionales, incl. día pago + próximo vencimiento en créditos, total por pagar en vivo) y AccountDetail (cupo con barra de uso, línea disp./usada, vencimientos, historial; eliminar SOLO sin movimientos, con confirmación inline en vez del confirm() nativo).
- `src/screens/Movimientos.jsx`: buscador (comercio/nota/categoría/cuenta), filtros Todo/Este mes/Futuros, filas con estados. Nota: el filtro "Futuros" del prototipo no filtraba nada; aquí filtra `month > mes actual`.
- `src/App.jsx`: frame móvil 430px del prototipo, tab bar, toast, switch de modales; motor puro conectado vía `useMemo`.
- **Verificado en navegador (usuario andres@gmail.com)**: creadas cuentas banco (saldo 500.000 + línea 200.000), tarjeta (cupo 1.000.000, cierre 24/venc 5) y crédito (8×150.000 = 1.200.000 por pagar); patrimonio -700.000 correcto (cupo no suma); persistencia tras recarga OK; gasto confirmado baja saldo y pendiente NO (regla 1 con datos reales); buscador y detalle OK; cuenta con movimientos no muestra botón eliminar. Datos de prueba de movimientos eliminados; las 3 cuentas de prueba quedaron creadas (el dueño puede borrarlas desde el detalle).

### Fase 3 — Registro de movimientos: COMPLETA (2026-07-09)
- `src/components/MovementModals.jsx`: QuickAdd (parser "Uber 8.500" → monto+comercio, aviso si no hay cuentas de dinero con derivación a crear cuenta o Gasto TC), CardPurchase (cuotas 1–36 con presets + input libre, primera ahora/diferida, compra en curso con stepper "próxima cuota X/N", preview de cuotas por venir, validación contra cupo usando monto restante), PayCard/PayCredit (origen con avail, aviso azul al usar línea, bloqueo si excede saldo+línea), PayLine (solo bancos con línea usada, solo origen con dinero real), Transfer (nuevo — no estaba en el prototipo; mismo estilo, puede usar línea con aviso).
- FAB radial en `src/App.jsx` (6 acciones) + acciones de negocio que conectan los builders puros del motor con `addMovements`.
- **Bug del prototipo corregido en el motor**: los topes `Math.max(0,…)` dentro del loop hacían que el resultado dependiera del orden del array (un pago procesado antes que sus cuotas se perdía — visible porque la DB devuelve ts desc). Ahora las sumas son conmutativas y los topes se aplican al final; test de independencia de orden agregado (28 tests verdes).
- Bug de UI corregido en Transfer: al cambiar "Desde" a la cuenta seleccionada en "Hacia", el estado quedaba apuntando a la misma cuenta.
- **Escenario real del dueño verificado e2e en navegador**: compra TC en curso 900.000×12 con próxima cuota 4 → 9 cuotas de 75.000 (jul 2026–mar 2027) persistidas; pago TC de 550.000 desde banco con saldo 500.000 → aviso azul "usarás $50.000 de la línea", saldo −50.000; pago de línea 50.000 desde efectivo → banco $0 y línea disp. completa; cupo Visa 875.000 y patrimonio cuadran. QuickAdd y transferencia verificados. Movimientos de prueba eliminados al cierre (las 4 cuentas de prueba quedan, sin movimientos son eliminables desde la UI).

### Fase 4 — Inicio, Presupuesto, Pulso, Programados: COMPLETA (2026-07-09)
- Hooks nuevos en `src/lib/useData.js`: `useBudgets` (mapa anidado `{ "YYYY-MM": { catId: monto } }` ↔ filas DB, `setBudget` con upsert onConflict `user_id,month,category_id`) y `useScheduled` (add/delete sobre la tabla `scheduled`).
- `src/screens/Inicio.jsx`: hero Disponible del mes (toggle Mes/Total), Esperado/Patrimonio, ingresos/gastos del mes, tarjeta acceso a Pulso, carruseles Dinero y Deudas y cupos (con línea disp./usada), últimos 3 movimientos.
- `src/screens/Presupuesto.jsx` + `src/components/BudgetModals.jsx`: asignación por categoría/mes (sheet `BudgetAssign` en vez del `prompt()` del prototipo), gastado vs asignado con barra de progreso (cuotas TC cuentan en su mes), agrupación por prioridad, navegación de meses. Categorías CRUD (tipo, prioridad, ícono, color) con eliminar.
- `src/components/PulseScheduled.jsx`: Pulso (wizard cuenta por cuenta esperado vs real; la diferencia se registra como movimiento `cuadrado` trazable vía `pulseAdjust`) y Programados (add + confirmar; recién al confirmar se crea el movimiento y se quita de la lista). Accesos en la pantalla Más.
- **Verificado e2e en navegador**: categoría creada y persistida; presupuesto $250.000 asignado (upsert, sin duplicar); Pulso con real 490.000 vs esperado 500.000 generó gasto `cuadrado` de 10.000 y el saldo del banco pasó a 490.000; programado "Sueldo" 1.200.000 NO creó movimiento hasta confirmarlo, y al confirmar creó el ingreso y desapareció de la lista. Datos de prueba (movimientos/budgets/categorías) limpiados al cierre; quedan las 4 cuentas de prueba.
- Nota de tooling: en el preview headless, el `.click()` sintético via eval no dispara los onClick de React de forma fiable en botones dentro de sheets; se usó el click real del preview tool (tag por id) para esos casos. No afecta la app real.

### Fase 5 — Export, PWA y pulido: COMPLETA (2026-07-09)
- Export en `src/lib/export.js`: `exportCSV` (BOM UTF-8, CRLF, todos los kinds; salidas de dinero —gasto/cuotaTC/pagos— con monto negativo, ingreso/transferencia positivo) y `exportXLSX` (SheetJS, hojas Movimientos + Cuentas). Botones en la pantalla Más; avisa si no hay movimientos.
- Íconos PWA generados con `scripts/gen-icons.mjs` (encoder PNG propio con zlib de Node, **sin dependencias nuevas**): degradado teal→azul con barras ascendentes. Salidas en `public/`: pwa-192, pwa-512, maskable-512, apple-touch-icon (180). Regenerar con `node scripts/gen-icons.mjs`.
- `vite.config.js`: manifest completo (name, íconos incl. maskable, standalone, portrait, es-CL). `index.html`: apple-touch-icon + metas `apple-mobile-web-app-*` + theme-color + viewport-fit=cover para instalación en iPhone.
- Pulido: `LoadingSkeleton` (bloques con pulse) reemplaza el texto "Cargando…"; estados vacíos con CTA (ya existían) y toasts (ya existían).
- **Verificado en navegador**: CSV exportado con BOM (bytes EF BB BF) y tildes intactas ("Almacén Ñuñoa", "Té y café"), signos correctos; XLSX se genera sin errores; `dist/index.html` de producción enlaza manifest + registerSW + apple-touch-icon + metas iOS; íconos sirven 200. (El manifest no se inyecta en modo dev de vite-plugin-pwa — es esperado; sí está en el build de producción.)
- **Dependencia nueva**: `xlsx` (SheetJS, ya aprobada en CLAUDE.md). Advisory de seguridad conocido en xlsx aplica solo al PARSEO de archivos maliciosos; la app únicamente ESCRIBE xlsx con datos propios, sin exposición.

### Revisión de código post-fase-5 (2026-07-09)
Pasada de revisión general; 4 hallazgos corregidos y verificados:
1. **Borrar movimiento desde la UI** (antes no existía): `MovRow` acepta `onDelete` con confirmación inline; wired en Movimientos y detalle de cuenta. Borrar una cuota TC elimina la **compra completa** (todas sus cuotas del `purchase_group`) vía `deleteMovements`/`removeMany` (delete `.in(id)`). Verificado e2e: grupo de 3 cuotas y gasto simple borrados de UI+DB, mensajes de confirmación distintos por tipo.
2. **Pulso ya no ensucia categorías**: `pulseAdjust` usa `categoryId: null` (antes caía en la primera categoría de gasto por nombre, distorsionando su presupuesto).
3. **setBudget(0) borra la fila** en vez de dejar un 0 huérfano (delete filtrado por user/month/category; verificado bajo RLS).
4. **Inputs numéricos no negativos**: `min="0"` en todos los inputs de monto + clamp `Math.max(0, …)` al crear cuenta.

### Categorías predefinidas (2026-07-09)
- `src/lib/defaults.js`: 13 categorías comunes (Chile) agrupadas por prioridad. Se **siembran automáticamente** la primera vez que una cuenta no tiene ninguna (efecto en `App.jsx`, gated con flag `micuadra_seeded_categorias_<userId>` en localStorage para no re-sembrar si el usuario las borra). Botón manual "✨ Agregar categorías sugeridas" en el estado vacío de la modal de Categorías (`shared.seedCategories`). Verificado e2e: login sembró las 13 y quedaron agrupadas en Presupuesto.

### Despliegue (2026-07-09)
- Repo en GitHub: `andresvillanuevas-cloud/appfinanzas` (rama `master`). Push → Vercel auto-deploy.
- Producción: `appfinanzas-brown.vercel.app`. Env vars en Vercel: `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (**usar la publishable `sb_publishable_…`, NO la JWT legacy `eyJ…` — el proyecto rechaza la legacy con "Invalid API key"**). Cambiar env var requiere Redeploy manual (Vite hornea en build).
- PWA con `registerType: autoUpdate` → la app instalada se actualiza sola.

### Fase 6 — parcial, sin gastos compartidos en pareja (2026-07-09)
Se implementaron 4 de los 6 ítems del backlog original; 2 se descartaron por incompatibilidad con la arquitectura PWA/CLP-only (decisión explícita del dueño, no pendiente):
- **Modo claro**: paleta migrada a variables CSS (`--mc-*` en `index.css`, `[data-theme]`), toggle en Más, persistido en localStorage. Acentos de color (teal/rojo/etc.) quedan iguales en ambos temas porque se guardan como hex en la DB (color de cuenta/categoría).
- **Gráficos de tendencia** (`src/components/Tendencia.jsx`, sin librerías): ingresos vs gastos de los últimos 6 meses (barras) + desglose de gastos por categoría del mes actual. Acceso desde Más.
- **Historial de cuotas pagadas**: en el detalle de una tarjeta, las cuotas 1..(startIndex-1) de una compra "en curso" (que nunca existieron como movimientos) se reconstruyen y muestran agrupadas por `purchaseGroup` bajo "Cuotas ya pagadas".
- **Reglas recurrentes en Programados**: columna `frequency` (`unico`/`mensual`/`semanal`) en `scheduled` — migración `supabase/migrations/0002_scheduled_frequency.sql` (**pendiente correr en Supabase**, no se puede vía anon key). Si es recurrente, confirmar NO borra el programado de la lista (antes siempre se borraba).
- **Descartados**: widgets/atajos de iOS (requieren app nativa, no viable en PWA) y multi-moneda (rompe el diseño CLP-only validado; proyecto aparte).
- **Selector de fecha en transacciones** (pedido del dueño, fuera del backlog original): helpers `todayDateStr`/`dateStrToMonth`/`dateStrToTs` en engine.js; componente `DateField` en ui.jsx (tope: no permite fecha futura, para eso están los Programados). Agregado a Registro rápido, Gasto TC (reemplaza el toggle "Ahora/Diferida" — ese toggle ahora es exclusivamente sobre el MES DE FACTURACIÓN de la primera cuota, no la fecha de compra, son conceptos distintos), Pago TC, Pago crédito, Pago línea y Transferencia. `month` se deriva de la fecha elegida (importante para que quede en el presupuesto del mes correcto), `ts` para orden/CSV.

### Migración 0002 corrida en Supabase (2026-07-10)
Confirmado: `scheduled.frequency` existe en producción (200 OK vía REST). Verificado e2e el flujo recurrente completo: programado mensual creado → confirmado → genera el movimiento y **permanece en la lista** (antes se borraba siempre). Tarea de Fase 6 cerrada.

### Notas visibles + Pagos proyectados + Estado de cuenta TC (2026-07-10)
Pedido del dueño, fuera del backlog original. Todo es agregación de **solo lectura** sobre `movements` ya existentes — no se tocó `computeBalances` ni se creó ningún movimiento nuevo, por lo que las reglas de negocio 1–11 no corren riesgo (se revisó CLAUDE.md antes de escribir código, como se pidió).
- **Notas en movimientos**: `MovRow` (ui.jsx) muestra `m.note` truncada con ellipsis debajo de la cuenta/categoría. Nuevo componente `MovementDetail` (ui.jsx) — sheet de solo lectura con cuenta, categoría, cuota (si aplica), mes, fecha, estado y la **nota completa**. Se abre tocando la fila (excepto el ícono de papelera, que usa `stopPropagation`). Registrado como modal `movementDetail` en App.jsx; conectado en Movimientos, Inicio y el detalle de cuenta.
- **Pagos proyectados** (detalle de tarjeta): helper puro `projectedCardPayments(movements, cardId, fromMonth)` en engine.js — agrupa cuotas TC por mes de facturación desde el mes actual en adelante, solo meses con monto > 0. Formato "Agosto 2026 — $500.000" vía nuevo helper `keyToLabelLargo` en theme.js.
- **Estado de cuenta** (detalle de tarjeta): helper puro `cardStatement(movements, cardId, month)` — separa compras/pagos del mes en Confirmadas/Por confirmar/Abonado/Por pagar. UI con `MonthNav` para navegar el período, grid 2×2 de stats, y tabs Todos/Por confirmar/Compras que filtran la lista. Para cuentas tipo tarjeta esta sección **reemplaza** la lista plana "Movimientos" (que seguía duplicando lo mismo sin filtro); para el resto de tipos de cuenta la lista plana se mantiene igual.
- Nota: "Por confirmar" en cuotas TC casi siempre mostrará $0 porque `registerCardPurchase` siempre crea las cuotas con `status: "confirmado"` — no hay flujo de importación bancaria en esta app que genere cuotas `pendiente`. El tab existe por si a futuro se agrega esa fuente.
- 4 tests nuevos en engine.test.js (33/33 verdes) cubriendo agrupación cronológica, exclusión de meses previos a `fromMonth`, aislamiento por tarjeta/kind, y el desglose de los 4 stats.
- Verificado e2e con datos reales: compra de 3 cuotas con nota larga, otra sin nota, un pago parcial — los 4 stats, la proyección y el detalle de movimiento con nota completa cuadraron exactamente.

### Proyección consolidada TC + Gasto real por categoría (2026-07-10)
Dos vistas de REPORTE de solo lectura. No se tocó `computeBalances` ni ningún cálculo de saldos/presupuesto — son agregaciones derivadas que se pueden quitar sin romper nada.
- **`projectedCardPaymentsAll(movements, fromMonth)`** (engine.js): igual que `projectedCardPayments` per-card pero consolidando TODAS las tarjetas. UI: card "Proyección de cuotas" en la pantalla Cuentas, debajo del hero (solo si hay proyección). Lista mes→monto ("Agosto 2026 — $1.000.000").
- **`realExpenseByCategory(movements, month)`** (engine.js): gasto real por categoría. **Diferencia clave con computeMonthStats/Presupuesto**: una compra TC cuenta COMPLETA en su mes de compra (mes del `ts` de la cuota más temprana del `purchaseGroup`), NO distribuida en cuotas. Devuelve categorías con total + items para el drill-down.
- **Pantalla Gasto real** (`src/components/GastoReal.jsx`): sheet de SOLO LECTURA accesible desde Más → "Gasto real". Selector de mes + lista de categorías (con % y barra) + drill-down a los items que componen cada total (gastos sueltos + compras TC agrupadas). Sin edición, sin presupuesto comparado, sin acciones. No toca la pantalla Presupuesto.
- 6 tests nuevos (39/39 verdes): suma de 2 tarjetas en proyección consolidada; compra TC contada completa en su mes y ausente en meses siguientes; orden/agrupación/exclusiones.
- Verificado e2e: proyección Jul/Ago/Sep $100k c/u (facturación distribuida) vs Gasto real Julio $373k con la compra TC completa en $300k y agosto en $0 (no distribuida). Drill-down muestra items en lectura.

### Auditoría QA final + fixes menores (2026-07-10)
Auditoría completa (5 bloques): build ok, 39/39 tests, sin secrets/console.log, **11/11 reglas de negocio cumplen**. Regla 11 (programados) verificada a nivel de DB: crear no inserta en `movements` ni cambia saldo; solo confirmar lo hace. Causa raíz resuelta por arquitectura (tablas `scheduled`/`movements` separadas; `computeBalances` solo recibe `movements`). Casos borde numéricos, flujos e2e y funciones nuevas: todo pasa.
Se corrigieron los 3 hallazgos más relevantes (todos eran Menor, ninguno tocaba saldos):
- **Dedup al confirmar programado recurrente**: si ya se confirmó ese programado en el mes actual (match por nombre+tipo+monto+cuenta+mes), la fila muestra "✓ Ya confirmado este mes" y el botón pide una segunda confirmación ("Ya lo registraste este mes. ¿Confirmar otra vez?") antes de crear otro movimiento. Evita doble-conteo accidental de sueldo/arriendo; el escape "Sí, de nuevo" permite el caso legítimo (bono).
- **Gasto real**: nota visible aclarando que las compras en cuotas se cuentan en su mes de compra y que para compras "ya en curso" el mes es aproximado (el de registro).
- **Hero de Cuentas**: "Esperado" = patrimonio + neto de movimientos pendientes; "Por confirmar" = ese neto (antes ambos mostraban el patrimonio duplicado).
Hallazgos menores NO corregidos (documentados, no bloqueantes): programados no tienen campo de fecha (solo frecuencia); la proyección consolidada no puede excluir cuotas ya pagadas (no hay marca por-cuota); guard de borrar cuenta es solo-UI; CSV exporta transferencia con signo +.

### Fix: Gasto real no reconstruía el total de compras "en curso" (2026-07-12)
Reportado por el dueño: una impresora de 100.000 en 10 cuotas con 7 ya pagadas (solo existen las 3 cuotas restantes como movimientos) se veía en Gasto real como 30.000 en vez de 100.000.
- `realExpenseByCategory` ahora detecta compras en curso (`minIdx > 1` dentro del `purchaseGroup`) y reconstruye el total como `monto de la cuota de mayor índice × cuotasTotal` (esa cuota lleva el "per" base sin remanente). Compras nuevas (no en curso) siguen usando la suma exacta de sus cuotas, para no romper el ajuste de redondeo al peso.
- El item del drill-down lleva `enCurso: true/false`; la UI (`GastoReal.jsx`) muestra "≈ total reconstruido (compra en curso)" para dejar claro que es una aproximación.
- Recordatorio para el dueño: el mes en que aparece la compra en Gasto real es el de la **fecha de compra** que se ingresó al registrarla (no se puede inferir sola) — si se deja en "hoy" al cargar una compra vieja, aparecerá en el mes actual, no en el mes real de la compra.
- 2 tests nuevos (41/41 verdes).

### Feature: permitir superar el cupo de la tarjeta con advertencia (2026-07-12)
Pedido del dueño: a veces necesita registrar una compra que excede el cupo disponible (ej. la tarjeta no lo bloqueó en el POS, o es un ajuste manual). Antes el botón "Registrar compra" quedaba bloqueado sin salida.
- `CardPurchase` (MovementModals.jsx): nuevo estado `allowOverLimit`. Cuando el monto excede el cupo disponible, aparece un checkbox "Permitir superar el cupo disponible" junto a la advertencia roja existente. Sin marcar, el botón sigue deshabilitado (comportamiento previo intacto); marcado, permite guardar igual.
- No cambia el motor: `cardUsed` simplemente queda por sobre el `cupo` de la cuenta (ya soportado, solo se mostraría con "uso" >100% si corresponde revisar esa barra a futuro).
- Verificado e2e: compra de $1.500.000 con cupo disponible $1.000.000 — bloqueada sin el checkbox, guardada correctamente al marcarlo.

### Deuda total más visible en el detalle de tarjeta (2026-07-12)
Pedido del dueño tras preguntar cómo se comporta la deuda cuando no paga una cuota (aclarado que la app no arrastra cuotas impagas al mes siguiente; `cardUsed`/"por facturar" ya era la deuda real total, pero estaba poco visible).
- `AccountDetail` (isCard): el hero pasó de mostrar "CUPO DISPONIBLE" como número principal a mostrar **"DEUDA TOTAL (por facturar)"** en grande y en naranja (color de deuda de la paleta), con "Cupo disponible X de Y" como texto secundario debajo.
- Barra de uso de cupo: ahora se pone roja si `uso >= 100%` (posible desde que se permite superar el cupo).
- Se eliminó la fila duplicada "USADO" (mostraba el mismo valor que "POR FACTURAR"); ahora la fila de 3 stats es POR FACTURAR / CUPO TOTAL / DISPONIBLE (disponible en rojo si quedó negativo).
- Verificado e2e: tarjeta con $900.000 facturados de $1.000.000 de cupo — deuda total $900.000 destacada, uso 90%, disponible $100.000.

### Estado v1: LISTO PARA USO REAL. Fases 0–6 + reportes + auditoría QA (11/11 reglas) + fixes menores + fix gasto real en curso + override de cupo + deuda total visible, desplegado en Vercel. Pendiente único: validar instalación PWA en un iPhone real (criterio 11 del brief).

- Commits pequeños por feature, mensajes en español.
- Nada de librerías nuevas sin preguntar (excepciones ya aprobadas: supabase-js, vite-plugin-pwa, vitest, SheetJS).
- Montos siempre enteros CLP (bigint); nunca floats.
- Ante ambigüedad de UX: mirar `cuadra.jsx` primero; si no está ahí, preguntar antes de inventar.
- Al cerrar cada fase, actualizar una sección `## Estado` al final de este archivo con lo hecho y lo pendiente.
