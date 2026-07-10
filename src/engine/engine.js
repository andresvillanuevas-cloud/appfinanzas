/* ============================================================
   MOTOR CONTABLE PURO — portado de cuadra.jsx (fuente de verdad).
   Sin React, sin Supabase. Solo funciones puras sobre datos planos.

   Reglas anti-duplicación (CLAUDE.md, reglas 1–11):
   - Saldo cuenta = inicial + movimientos confirmados/cuadrados
   - Pendiente NUNCA toca saldo
   - Transferencia NO es gasto
   - Cuota TC consume presupuesto en su mes y sube "por facturar"
   - Pago TC/crédito mueve dinero real y baja deuda, NO es gasto
   - Cupo de tarjeta ≠ dinero real (patrimonio no lo cuenta)
   - Línea de crédito: saldo puede bajar hasta -line; la línea se
     paga SOLO con dinero real de otra cuenta
   ============================================================ */

// ---------- helpers de meses ----------
export const monthKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

export const addMonths = (key, n) => {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return monthKey(d);
};

export const todayKey = () => monthKey(new Date());

// ---------- helpers de fecha exacta (para el selector de fecha en registros) ----------
// "YYYY-MM-DD" en hora LOCAL (no toISOString, que usa UTC y puede correr el día).
export const todayDateStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const dateStrToMonth = (dateStr) => dateStr.slice(0, 7);
// mediodía local: evita que un cambio de huso horario corra la fecha al parsear.
export const dateStrToTs = (dateStr) => new Date(`${dateStr}T12:00:00`).getTime();

// UUID v4 real: los ids generados aquí se insertan tal cual en Postgres (columnas uuid)
export const uid = () =>
  globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
      });

// ---------- motor de saldos ----------
// computeBalances(accounts, movements) →
//   { bal, debt, cardUsed, lineUsed, avail, patrimonio, totalDinero }
export function computeBalances(accounts, movements) {
  // saldo por cuenta (créditos no tienen saldo de dinero)
  const bal = {};
  accounts.forEach((a) => (bal[a.id] = a.type === "credito" ? 0 : a.initial || 0));

  // deuda por cuenta de crédito (total por pagar)
  const debt = {};
  accounts.forEach((a) => {
    if (a.type === "credito") debt[a.id] = (a.cuotaValue || 0) * (a.cuotasRestantes || 0);
  });

  // uso de cupo por tarjeta (por facturar)
  const cardUsed = {};
  accounts.forEach((a) => { if (a.type === "tarjeta") cardUsed[a.id] = 0; });

  // Todas las operaciones son sumas conmutativas: el resultado NO depende del
  // orden del array. Los topes a 0 (no deber "de menos" tras un sobre-pago) se
  // aplican AL FINAL — el prototipo los aplicaba dentro del loop, lo que hacía
  // que un pago procesado antes que sus cuotas se perdiera (bug latente).
  movements.forEach((m) => {
    const conf = m.status === "confirmado" || m.status === "cuadrado";
    if (m.kind === "gasto" && conf) {
      if (m.accountId != null && bal[m.accountId] != null) bal[m.accountId] -= m.amount;
    } else if (m.kind === "ingreso" && conf) {
      if (bal[m.accountId] != null) bal[m.accountId] += m.amount;
    } else if (m.kind === "transferencia" && conf) {
      if (bal[m.fromId] != null) bal[m.fromId] -= m.amount;
      if (bal[m.toId] != null) bal[m.toId] += m.amount;
    } else if (m.kind === "cuotaTC") {
      // aumenta uso de cupo (por facturar) mientras no esté pagada
      if (cardUsed[m.accountId] != null && !m.paid) cardUsed[m.accountId] += m.amount;
    } else if (m.kind === "pagoTarjeta" && conf) {
      // mueve dinero real y reduce por-facturar
      if (bal[m.fromId] != null) bal[m.fromId] -= m.amount;
      if (cardUsed[m.cardId] != null) cardUsed[m.cardId] -= m.amount;
    } else if (m.kind === "pagoCredito" && conf) {
      if (bal[m.fromId] != null) bal[m.fromId] -= m.amount;
      if (debt[m.creditId] != null) debt[m.creditId] -= m.amount;
    } else if (m.kind === "pagoLinea" && conf) {
      // paga la línea usada: baja dinero real de origen y sube el saldo negativo del banco hacia 0
      if (bal[m.fromId] != null) bal[m.fromId] -= m.amount;
      if (bal[m.bankId] != null) bal[m.bankId] += m.amount;
    }
  });

  // tope: por-facturar y deuda nunca quedan negativos (sobre-pagos)
  Object.keys(cardUsed).forEach((id) => { cardUsed[id] = Math.max(0, cardUsed[id]); });
  Object.keys(debt).forEach((id) => { debt[id] = Math.max(0, debt[id]); });

  // patrimonio = dinero real (no cupos). Saldo negativo (línea usada) resta.
  const patrimonio = accounts.reduce((s, a) => {
    if (a.type === "tarjeta") return s; // cupo no es dinero
    if (a.type === "credito") return s - (debt[a.id] || 0); // deuda resta
    return s + (bal[a.id] || 0);
  }, 0);

  const totalDinero = accounts
    .filter((a) => a.type !== "tarjeta" && a.type !== "credito")
    .reduce((s, a) => s + (bal[a.id] || 0), 0);

  // línea usada por cuenta (saldo negativo = deuda de línea) y disponible (saldo real + línea libre)
  const lineUsed = {};
  const avail = {};
  accounts.forEach((a) => {
    if (a.type === "tarjeta" || a.type === "credito") return;
    const b = bal[a.id] || 0;
    lineUsed[a.id] = b < 0 ? -b : 0;
    const lineLibre = Math.max(0, (a.line || 0) - lineUsed[a.id]);
    avail[a.id] = b + lineLibre; // lo que realmente se puede usar para pagar
  });

  return { bal, debt, cardUsed, lineUsed, avail, patrimonio, totalDinero };
}

// ---------- estadísticas del mes ----------
// Ingresos/gastos del mes: gasto y cuotaTC consumen presupuesto en su mes;
// transferencias y pagos de deuda NO cuentan como gasto (anti-duplicación).
export function computeMonthStats(movements, month) {
  let ing = 0, gas = 0;
  movements.forEach((m) => {
    if (m.month !== month) return;
    const conf = m.status === "confirmado" || m.status === "cuadrado";
    if (!conf) return;
    if (m.kind === "ingreso") ing += m.amount;
    if (m.kind === "gasto") gas += m.amount;
    if (m.kind === "cuotaTC") gas += m.amount; // la cuota usa presupuesto en su mes
  });
  return { ing, gas };
}

// ---------- compra con tarjeta de crédito ----------
// Genera las cuotas de una compra TC. Pura: devuelve la lista de movimientos.
// startIndex = próxima cuota a facturar (1 = compra nueva, 4 = ya se pagaron 3).
// Solo se crean las cuotas startIndex..cuotas, en meses consecutivos desde firstMonth.
//
// Reparto de montos: cuota base = round(total / cuotas); el remanente de
// redondeo (positivo o negativo) se ajusta en la PRIMERA cuota creada.
// Nota: el prototipo usaba floor (5.000/3 → 1.668+1.666+1.666); se cambió a
// round para cumplir el caso de aceptación de CLAUDE.md (1.667+1.667+1.666).
export function registerCardPurchase({
  cardId, merchant, categoryId, total, cuotas, firstMonth, note, startIndex = 1, ts,
}) {
  const per = Math.round(total / cuotas);
  const rem = total - per * cuotas;
  const list = [];
  let created = 0;
  const group = uid(); // mismo grupo = misma compra
  const baseTs = ts || Date.now();
  for (let i = startIndex - 1; i < cuotas; i++) {
    list.push({
      id: uid(),
      ts: baseTs + i,
      kind: "cuotaTC",
      merchant,
      accountId: cardId,
      categoryId,
      amount: per + (created === 0 ? rem : 0),
      cuotaIndex: i + 1,
      cuotasTotal: cuotas,
      purchaseGroup: group,
      // la primera cuota pendiente cae en firstMonth; las siguientes, meses consecutivos
      month: addMonths(firstMonth, i - (startIndex - 1)),
      status: "confirmado",
      note,
      paid: false,
    });
    created++;
  }
  return list;
}

// ---------- pagos (constructores puros de movimientos) ----------
// `ts`/`month` son opcionales: permiten registrar con fecha pasada
// (ej. "esto lo pagué ayer") en vez de siempre "ahora".
export const buildCardPayment = ({ cardId, fromId, amount, month, ts }) => ({
  id: uid(), ts: ts || Date.now(), kind: "pagoTarjeta", cardId, fromId, amount,
  month: month || todayKey(), status: "confirmado", merchant: "Pago tarjeta",
});

export const buildCreditPayment = ({ creditId, fromId, amount, month, ts }) => ({
  id: uid(), ts: ts || Date.now(), kind: "pagoCredito", creditId, fromId, amount,
  month: month || todayKey(), status: "confirmado", merchant: "Pago crédito",
});

export const buildLinePayment = ({ bankId, fromId, amount, month, ts }) => ({
  id: uid(), ts: ts || Date.now(), kind: "pagoLinea", bankId, fromId, amount,
  month: month || todayKey(), status: "confirmado", merchant: "Pago línea",
});

export const buildTransfer = ({ fromId, toId, amount, month, note, ts }) => ({
  id: uid(), ts: ts || Date.now(), kind: "transferencia", fromId, toId, amount,
  month: month || todayKey(), status: "confirmado", merchant: "Transferencia", note,
});

// ---------- validaciones de pago (mismas reglas que los modales del prototipo) ----------
// Pago TC/crédito: puede usar saldo real + línea disponible, nunca más.
export function validateDebtPayment(engine, fromId, amount) {
  const disp = engine.avail[fromId] || 0;
  const real = engine.bal[fromId] || 0;
  if (!(amount > 0)) return { ok: false, reason: "monto-invalido" };
  if (amount > disp) return { ok: false, reason: "excede-saldo-mas-linea" };
  return { ok: true, usaLinea: amount > real, lineaUsada: amount > real ? amount - real : 0 };
}

// Pago de línea usada: SOLO dinero real de otra cuenta, hasta la línea usada.
export function validateLinePayment(engine, bankId, fromId, amount) {
  const real = engine.bal[fromId] || 0;
  const usada = engine.lineUsed[bankId] || 0;
  if (!(amount > 0)) return { ok: false, reason: "monto-invalido" };
  if (fromId === bankId) return { ok: false, reason: "misma-cuenta" };
  if (amount > real) return { ok: false, reason: "origen-sin-saldo-real" };
  if (amount > usada) return { ok: false, reason: "supera-linea-usada" };
  return { ok: true };
}

// ---------- Pulso (conciliación) ----------
// La diferencia esperado-vs-real SIEMPRE se registra como movimiento trazable
// (gasto/ingreso con estado 'cuadrado'), nunca como ajuste silencioso del saldo.
export function buildPulseAdjustment({ accountId, diff, categoryId, month }) {
  if (diff === 0) return null;
  return {
    id: uid(),
    ts: Date.now(),
    kind: diff < 0 ? "gasto" : "ingreso",
    accountId,
    amount: Math.abs(diff),
    categoryId,
    merchant: "Ajuste Pulso",
    month: month || todayKey(),
    status: "cuadrado",
    note: "Diferencia registrada por Pulso",
  };
}

// ---------- Programados ----------
// Un programado NO toca saldos: solo al confirmarlo se convierte en movimiento.
export function confirmScheduled(sch, month) {
  return {
    id: uid(),
    ts: Date.now(),
    kind: sch.kind,
    accountId: sch.accountId,
    amount: sch.amount,
    categoryId: sch.categoryId,
    merchant: sch.name,
    month: month || todayKey(),
    status: "confirmado",
    note: "Programado confirmado",
  };
}
