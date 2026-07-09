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

### Próximo: Fase 1 — Motor contable puro

- Commits pequeños por feature, mensajes en español.
- Nada de librerías nuevas sin preguntar (excepciones ya aprobadas: supabase-js, vite-plugin-pwa, vitest, SheetJS).
- Montos siempre enteros CLP (bigint); nunca floats.
- Ante ambigüedad de UX: mirar `cuadra.jsx` primero; si no está ahí, preguntar antes de inventar.
- Al cerrar cada fase, actualizar una sección `## Estado` al final de este archivo con lo hecho y lo pendiente.
