import React, { useState, useMemo, useEffect } from "react";

/* ============================================================
   CUADRA — réplica funcional (modo oscuro)
   App de finanzas personales: cuentas, movimientos, cuotas de
   tarjeta, créditos, presupuesto, Pulso (esperado vs real),
   programados y export CSV.

   Motor contable (reglas anti-duplicación):
   - Saldo cuenta = saldoInicial + movimientos confirmados/cuadrados de esa cuenta
   - Gasto reduce dinero y usa categoría
   - Transferencia (mover) NO cuenta como gasto del mes
   - Compra TC aumenta deuda + usa categoría UNA vez (por cuota, en su mes)
   - Pago de tarjeta/crédito baja deuda y mueve dinero real, NO es gasto nuevo
   - Cupo de tarjeta ≠ dinero real (patrimonio usa solo dinero real por defecto)
   ============================================================ */

// ---------- helpers ----------
const CLP = (n) =>
  "$" + Math.round(n).toLocaleString("es-CL", { maximumFractionDigits: 0 });

const uid = () => Math.random().toString(36).slice(2, 10);

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MESES_LARGO = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];

const monthKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const keyToLabel = (k) => {
  const [y, m] = k.split("-").map(Number);
  return `${MESES[m - 1]}. ${y}`;
};
const addMonths = (key, n) => {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return monthKey(d);
};
const todayKey = () => monthKey(new Date());

// ---------- paleta ----------
const C = {
  bg: "#05070a",
  bg2: "#0a0e14",
  card: "#141920",
  card2: "#1b222c",
  line: "#232b36",
  teal: "#1a8a6f",
  tealDim: "#12564a",
  tealSoft: "rgba(26,138,111,.16)",
  green: "#2ecc8f",
  red: "#ef5b6e",
  redSoft: "rgba(239,91,110,.12)",
  orange: "#e08b3e",
  orangeSoft: "rgba(224,139,62,.14)",
  blue: "#3f7fe0",
  blueSoft: "rgba(63,127,224,.16)",
  violet: "#6c5ce7",
  violetSoft: "rgba(108,92,231,.16)",
  txt: "#f2f5f8",
  sub: "#8b95a3",
  faint: "#5a6473",
};

const ACCOUNT_TYPES = [
  { id: "efectivo", label: "Efectivo", sub: "Billetera", icon: "💵", color: C.green, kind: "money" },
  { id: "banco", label: "Cuenta bancaria", sub: "Banco", icon: "🏛️", color: C.violet, kind: "money" },
  { id: "ahorro", label: "Ahorro", sub: "Reserva", icon: "🗄️", color: C.blue, kind: "money" },
  { id: "tarjeta", label: "Tarjeta de crédito", sub: "Cupo", icon: "💳", color: C.violet, kind: "card" },
  { id: "credito", label: "Crédito", sub: "Deuda", icon: "📄", color: C.orange, kind: "credit" },
  { id: "inversion", label: "Inversión", sub: "Valor", icon: "📈", color: C.orange, kind: "money" },
];

const PRIORIDADES = [
  { id: "obligaciones", label: "Obligaciones", color: C.blue },
  { id: "necesidades", label: "Necesidades", color: C.teal },
  { id: "gustos", label: "Gustos", color: C.orange },
];

// ============================================================
//  APP
// ============================================================
export default function App() {
  const [tab, setTab] = useState("inicio");
  const [accounts, setAccounts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [movements, setMovements] = useState([]); // gastos, ingresos, transferencias, cuotas TC, pagos
  const [scheduled, setScheduled] = useState([]); // programados (no tocan saldo)
  const [budgets, setBudgets] = useState({}); // { "mesKey": { catId: monto } }
  const [viewMonth, setViewMonth] = useState(todayKey());

  const [modal, setModal] = useState(null); // { type, props }
  const [fabOpen, setFabOpen] = useState(false);
  const [toast, setToast] = useState(null);

  const notify = (m) => { setToast(m); setTimeout(() => setToast(null), 2200); };

  // ---------- MOTOR CONTABLE ----------
  const engine = useMemo(() => {
    // saldo por cuenta
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
        if (cardUsed[m.cardId] != null) cardUsed[m.cardId] = Math.max(0, cardUsed[m.cardId] - m.amount);
      } else if (m.kind === "pagoCredito" && conf) {
        if (bal[m.fromId] != null) bal[m.fromId] -= m.amount;
        if (debt[m.creditId] != null) debt[m.creditId] = Math.max(0, debt[m.creditId] - m.amount);
      } else if (m.kind === "pagoLinea" && conf) {
        // paga la línea usada: baja dinero real de origen y sube el saldo negativo del banco hacia 0
        if (bal[m.fromId] != null) bal[m.fromId] -= m.amount;
        if (bal[m.bankId] != null) bal[m.bankId] += m.amount;
      }
    });

    // patrimonio = dinero real (no cupos). Saldo negativo (línea usada) resta.
    const patrimonio = accounts.reduce((s, a) => {
      if (a.type === "tarjeta") return s; // cupo no es dinero
      if (a.type === "credito") return s - (debt[a.id] || 0); // deuda resta
      return s + (bal[a.id] || 0);
    }, 0);

    const totalDinero = accounts
      .filter((a) => a.type !== "tarjeta" && a.type !== "credito")
      .reduce((s, a) => s + (bal[a.id] || 0), 0);

    // línea usada por cuenta (saldo negativo = deuda de línea) y disponible total (saldo real + línea libre)
    const lineUsed = {};
    const avail = {};
    accounts.forEach((a) => {
      if (a.type === "tarjeta" || a.type === "credito") return;
      const b = bal[a.id] || 0;
      lineUsed[a.id] = b < 0 ? -b : 0;
      const lineLibre = Math.max(0, (a.line || 0) - lineUsed[a.id]);
      avail[a.id] = b + lineLibre; // lo que realmente podés usar para pagar
    });

    return { bal, debt, cardUsed, patrimonio, totalDinero, lineUsed, avail };
  }, [accounts, movements]);

  // ingresos / gastos del mes visible
  const monthStats = useMemo(() => {
    let ing = 0, gas = 0;
    movements.forEach((m) => {
      if (m.month !== viewMonth) return;
      const conf = m.status === "confirmado" || m.status === "cuadrado";
      if (!conf) return;
      if (m.kind === "ingreso") ing += m.amount;
      if (m.kind === "gasto") gas += m.amount;
      if (m.kind === "cuotaTC") gas += m.amount; // la cuota usa presupuesto en su mes
    });
    return { ing, gas };
  }, [movements, viewMonth]);

  const acc = (id) => accounts.find((a) => a.id === id);
  const cat = (id) => categories.find((c) => c.id === id);

  // ---------- acciones ----------
  const addAccount = (a) => { setAccounts((p) => [...p, { ...a, id: uid() }]); notify("Cuenta creada"); };
  const addCategory = (c) => { setCategories((p) => [...p, { ...c, id: uid() }]); notify("Categoría creada"); };

  const addMovement = (m) => {
    setMovements((p) => [{ ...m, id: uid(), ts: Date.now() }, ...p]);
  };

  // registrar compra TC → genera cuotas. Si es compra en curso, sólo crea las que faltan.
  // startIndex = número de la próxima cuota a facturar (1 = compra nueva, 4 = ya pagaste 3).
  const registerCardPurchase = ({ cardId, merchant, categoryId, total, cuotas, firstMonth, note, startIndex = 1 }) => {
    const per = Math.floor(total / cuotas);
    const rem = total - per * cuotas;
    const list = [];
    let created = 0;
    for (let i = startIndex - 1; i < cuotas; i++) {
      list.push({
        id: uid(), ts: Date.now() + i, kind: "cuotaTC",
        merchant, accountId: cardId, categoryId,
        amount: per + (created === 0 ? rem : 0),
        cuotaIndex: i + 1, cuotasTotal: cuotas,
        // la primera cuota pendiente cae en firstMonth; las siguientes, meses consecutivos
        month: addMonths(firstMonth, i - (startIndex - 1)),
        status: "confirmado", note, paid: false,
      });
      created++;
    }
    setMovements((p) => [...list, ...p]);
    const n = cuotas - (startIndex - 1);
    notify(startIndex > 1 ? `Deuda en curso cargada (${n} cuotas por venir)` : `Compra en ${cuotas} ${cuotas === 1 ? "cuota" : "cuotas"} registrada`);
  };

  const payCard = ({ cardId, fromId, amount, month }) => {
    addMovement({ kind: "pagoTarjeta", cardId, fromId, amount, month: month || todayKey(), status: "confirmado", merchant: "Pago tarjeta" });
    notify("Pago de tarjeta registrado");
  };
  const payCredit = ({ creditId, fromId, amount, month }) => {
    addMovement({ kind: "pagoCredito", creditId, fromId, amount, month: month || todayKey(), status: "confirmado", merchant: "Pago crédito" });
    notify("Pago de crédito registrado");
  };
  const payLine = ({ bankId, fromId, amount, month }) => {
    addMovement({ kind: "pagoLinea", bankId, fromId, amount, month: month || todayKey(), status: "confirmado", merchant: "Pago línea" });
    notify("Pago de línea registrado");
  };

  // Pulso: registrar diferencia como movimiento trazable
  const pulseAdjust = ({ accountId, diff }) => {
    if (diff === 0) return;
    addMovement({
      kind: diff < 0 ? "gasto" : "ingreso",
      accountId, amount: Math.abs(diff),
      categoryId: categories.find((c) => c.type === (diff < 0 ? "gasto" : "ingreso"))?.id,
      merchant: "Ajuste Pulso", month: todayKey(), status: "cuadrado", note: "Diferencia registrada por Pulso",
    });
    notify("Diferencia registrada (trazable)");
  };

  // export CSV
  const exportCSV = () => {
    const rows = [["Fecha","Tipo","Comercio/Detalle","Categoria","Cuenta","Monto","Estado","Mes","Nota"]];
    movements.forEach((m) => {
      const tipo = { gasto: "Gasto", ingreso: "Ingreso", transferencia: "Transferencia", cuotaTC: "Cuota TC", pagoTarjeta: "Pago tarjeta", pagoCredito: "Pago crédito", pagoLinea: "Pago línea" }[m.kind] || m.kind;
      const cuenta = m.kind === "transferencia" ? `${acc(m.fromId)?.name || ""}→${acc(m.toId)?.name || ""}` : (acc(m.accountId || m.fromId || m.cardId || m.creditId)?.name || "");
      const categoria = cat(m.categoryId)?.name || "";
      const detalle = m.merchant || (m.kind === "cuotaTC" ? `${m.merchant} (cuota ${m.cuotaIndex}/${m.cuotasTotal})` : "");
      const signo = ["gasto","cuotaTC","pagoTarjeta","pagoCredito","pagoLinea"].includes(m.kind) ? -1 : 1;
      rows.push([
        new Date(m.ts).toLocaleDateString("es-CL"), tipo, detalle, categoria, cuenta,
        signo * m.amount, m.status || "", keyToLabel(m.month || ""), (m.note || "").replace(/[\n,]/g, " "),
      ]);
    });
    const csv = rows.map((r) => r.map((c) => `"${String(c)}"`).join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "cuadra_movimientos.csv"; a.click();
    URL.revokeObjectURL(url);
    notify("CSV exportado");
  };

  const shared = {
    accounts, categories, movements, scheduled, budgets, viewMonth, setViewMonth,
    engine, monthStats, acc, cat, C,
    addAccount, addCategory, addMovement, registerCardPurchase, payCard, payCredit, payLine, pulseAdjust,
    setModal, notify, exportCSV, setBudgets, setScheduled, setMovements, setAccounts,
  };

  return (
    <div style={{ minHeight: "100vh", background: "#000", display: "flex", justifyContent: "center", fontFamily: "-apple-system,BlinkMacSystemFont,'SF Pro Text',Segoe UI,Roboto,sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 430, background: C.bg, color: C.txt, minHeight: "100vh", position: "relative", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        {/* status bar fake */}
        <div style={{ height: 44, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 22px", fontSize: 15, fontWeight: 600, flexShrink: 0 }}>
          <span>{new Date().toLocaleTimeString("es-CL", { hour: "2-digit", minute: "2-digit" })}</span>
          <span style={{ letterSpacing: 1, fontSize: 13, color: C.sub }}>Cuadra</span>
          <span style={{ fontSize: 13 }}>􀛨 􀙇 100</span>
        </div>

        <div style={{ flex: 1, overflowY: "auto", paddingBottom: 120 }}>
          {tab === "inicio" && <Inicio {...shared} />}
          {tab === "presupuesto" && <Presupuesto {...shared} />}
          {tab === "movimientos" && <Movimientos {...shared} />}
          {tab === "cuentas" && <Cuentas {...shared} />}
          {tab === "mas" && <Mas {...shared} />}
        </div>

        {/* FAB radial */}
        {fabOpen && (
          <div onClick={() => setFabOpen(false)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.55)", backdropFilter: "blur(2px)", zIndex: 40 }}>
            <div style={{ position: "absolute", right: 20, bottom: 190, display: "flex", flexDirection: "column", gap: 12, alignItems: "flex-end" }}>
              {[
                ["Registro rápido", "􀋲", () => setModal({ type: "quick" })],
                ["Programados", "􀉉", () => setModal({ type: "scheduled" })],
                ["Gasto TC", "􀍯", () => setModal({ type: "cardPurchase" })],
                ["Pago TC", "􀍯", () => setModal({ type: "payCard" })],
                ["Pago crédito", "􀈎", () => setModal({ type: "payCredit" })],
                ["Pago línea", "🏦", () => setModal({ type: "payLine" })],
              ].map(([label, ic, fn]) => (
                <button key={label} onClick={(e) => { e.stopPropagation(); setFabOpen(false); fn(); }}
                  style={{ display: "flex", alignItems: "center", gap: 10, background: C.card2, border: "none", color: C.txt, padding: "13px 18px", borderRadius: 26, fontSize: 16, fontWeight: 700, boxShadow: "0 6px 20px rgba(0,0,0,.5)" }}>
                  {label}
                  <span style={{ width: 34, height: 34, borderRadius: 12, background: C.teal, display: "grid", placeItems: "center", fontSize: 15 }}>{ic}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* tab bar */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, zIndex: 45 }}>
          <button onClick={() => setFabOpen((v) => !v)} style={{ position: "absolute", right: 20, bottom: 78, width: 62, height: 62, borderRadius: 31, border: "none", background: `linear-gradient(140deg,${C.teal},${C.blue})`, color: "#fff", fontSize: 30, boxShadow: "0 8px 24px rgba(0,0,0,.5)", transform: fabOpen ? "rotate(45deg)" : "none", transition: ".2s", zIndex: 50 }}>+</button>
          <div style={{ background: "rgba(10,14,20,.92)", backdropFilter: "blur(20px)", borderTop: `1px solid ${C.line}`, display: "flex", padding: "10px 6px 26px" }}>
            {[
              ["inicio", "Inicio", "􀎞"],
              ["presupuesto", "Presupuesto", "􀋱"],
              ["movimientos", "Movimientos", "􀋳"],
              ["cuentas", "Cuentas", "􀍯"],
              ["mas", "Más", "􀍡"],
            ].map(([id, label, ic]) => (
              <button key={id} onClick={() => setTab(id)} style={{ flex: 1, background: "none", border: "none", color: tab === id ? C.teal : C.sub, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 600 }}>
                <span style={{ fontSize: 20 }}>{ic}</span>
                {label}
              </button>
            ))}
          </div>
        </div>

        {toast && (
          <div style={{ position: "absolute", bottom: 150, left: "50%", transform: "translateX(-50%)", background: C.card2, border: `1px solid ${C.line}`, color: C.txt, padding: "12px 20px", borderRadius: 14, fontSize: 14, fontWeight: 600, zIndex: 60, boxShadow: "0 8px 24px rgba(0,0,0,.5)" }}>{toast}</div>
        )}

        {modal && <Modal shared={shared} modal={modal} close={() => setModal(null)} />}
      </div>
    </div>
  );
}

// ============================================================
//  UI PRIMITIVES
// ============================================================
const Card = ({ children, style, onClick }) => (
  <div onClick={onClick} style={{ background: C.card, borderRadius: 20, padding: 16, border: `1px solid ${C.line}`, ...style }}>{children}</div>
);
const Eyebrow = ({ children }) => (
  <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, color: C.sub, textTransform: "uppercase" }}>{children}</div>
);
const Empty = ({ icon, title, sub, cta, onCta }) => (
  <Card style={{ textAlign: "center", padding: 28 }}>
    <div style={{ fontSize: 32, marginBottom: 8 }}>{icon}</div>
    <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{title}</div>
    <div style={{ color: C.sub, fontSize: 14, marginBottom: cta ? 16 : 0, lineHeight: 1.4 }}>{sub}</div>
    {cta && <button onClick={onCta} style={{ background: C.teal, border: "none", color: "#fff", padding: "12px 22px", borderRadius: 24, fontWeight: 700, fontSize: 15 }}>{cta}</button>}
  </Card>
);
const MonthNav = ({ value, onChange }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 4, background: C.card2, borderRadius: 20, padding: "6px 10px" }}>
    <button onClick={() => onChange(addMonths(value, -1))} style={{ background: "none", border: "none", color: C.teal, fontSize: 18, width: 26 }}>‹</button>
    <span style={{ fontWeight: 700, fontSize: 14, minWidth: 74, textAlign: "center" }}>{keyToLabel(value)}</span>
    <button onClick={() => onChange(addMonths(value, 1))} style={{ background: "none", border: "none", color: C.teal, fontSize: 18, width: 26 }}>›</button>
  </div>
);

// ============================================================
//  INICIO
// ============================================================
function Inicio({ engine, monthStats, accounts, movements, viewMonth, setViewMonth, acc, setModal, C }) {
  const [scope, setScope] = useState("mes");
  const disponible = scope === "mes" ? monthStats.ing - monthStats.gas : engine.totalDinero;
  const money = accounts.filter((a) => a.type !== "tarjeta" && a.type !== "credito");
  const deudas = accounts.filter((a) => a.type === "tarjeta" || a.type === "credito");
  const recent = movements.filter((m) => ["gasto","ingreso","transferencia","cuotaTC"].includes(m.kind)).slice(0, 3);

  return (
    <div style={{ padding: "6px 16px" }}>
      <h1 style={{ textAlign: "center", fontSize: 17, margin: "4px 0 16px" }}>Inicio</h1>

      {/* hero */}
      <div style={{ borderRadius: 24, padding: 20, background: `linear-gradient(150deg,${C.tealDim},${C.blue})`, marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, opacity: .85 }}>􀉉 DISPONIBLE DEL MES</span>
          <span style={{ fontSize: 12, fontWeight: 700, opacity: .8 }}>CLP</span>
        </div>
        <div style={{ display: "flex", background: "rgba(255,255,255,.12)", borderRadius: 22, padding: 4, marginBottom: 16 }}>
          {["mes", "total"].map((s) => (
            <button key={s} onClick={() => setScope(s)} style={{ flex: 1, border: "none", borderRadius: 18, padding: "9px 0", fontWeight: 700, fontSize: 14, background: scope === s ? "#fff" : "transparent", color: scope === s ? C.tealDim : "#fff" }}>{s === "mes" ? "Mes" : "Total"}</button>
          ))}
        </div>
        <div style={{ opacity: .85, fontSize: 14, marginBottom: 2 }}>Disponible</div>
        <div style={{ fontSize: 42, fontWeight: 800, marginBottom: 16 }}>{CLP(disponible)}</div>
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1, background: "rgba(255,255,255,.1)", borderRadius: 16, padding: "12px 14px" }}>
            <div style={{ fontSize: 12, opacity: .8 }}>􀐫 Esperado</div>
            <div style={{ fontWeight: 700, fontSize: 18 }}>{CLP(engine.totalDinero)}</div>
          </div>
          <div style={{ flex: 1, background: "rgba(255,255,255,.1)", borderRadius: 16, padding: "12px 14px" }}>
            <div style={{ fontSize: 12, opacity: .8 }}>􀯼 Patrimonio</div>
            <div style={{ fontWeight: 700, fontSize: 18 }}>{CLP(engine.patrimonio)}</div>
          </div>
        </div>
      </div>

      {/* ingresos / gastos */}
      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        <Card style={{ flex: 1, padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 30, height: 30, borderRadius: 15, background: C.tealSoft, color: C.green, display: "grid", placeItems: "center" }}>􀄩</span>
            <div><div style={{ fontSize: 11, color: C.sub, fontWeight: 700 }}>INGRESOS MES</div><div style={{ fontWeight: 700 }}>{CLP(monthStats.ing)}</div></div>
          </div>
        </Card>
        <Card style={{ flex: 1, padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 30, height: 30, borderRadius: 15, background: C.redSoft, color: C.red, display: "grid", placeItems: "center" }}>􀄨</span>
            <div><div style={{ fontSize: 11, color: C.sub, fontWeight: 700 }}>GASTOS MES</div><div style={{ fontWeight: 700 }}>{CLP(monthStats.gas)}</div></div>
          </div>
        </Card>
      </div>

      {/* pulso */}
      <Card onClick={() => setModal({ type: "pulse" })} style={{ marginBottom: 18, display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
        <span style={{ width: 42, height: 42, borderRadius: 14, background: C.tealSoft, color: C.green, display: "grid", placeItems: "center", fontSize: 18 }}>􀙤</span>
        <div style={{ flex: 1 }}><div style={{ fontWeight: 700 }}>¡A cuadrar!</div><div style={{ color: C.sub, fontSize: 13 }}>Revisa tus saldos al entrar</div></div>
        <span style={{ color: C.faint }}>›</span>
      </Card>

      {/* dinero */}
      <SectionHead label="Dinero" count={money.length} />
      {money.length === 0 ? (
        <Empty icon="💳" title="Crea tu primera cuenta" sub="Agrega efectivo, banco o ahorro para empezar a registrar movimientos." cta="Crear cuenta" onCta={() => setModal({ type: "newAccount" })} />
      ) : (
        <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 6, marginBottom: 18 }}>
          {money.map((a) => (
            <div key={a.id} onClick={() => setModal({ type: "accountDetail", accountId: a.id })} style={{ minWidth: 160, background: C.card, borderRadius: 18, padding: 16, border: `1px solid ${C.line}` }}>
              <div style={{ height: 4, width: 44, borderRadius: 2, background: a.color, marginBottom: 12 }} />
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
                <span style={{ fontSize: 22 }}>{ACCOUNT_TYPES.find((t) => t.id === a.type)?.icon}</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: a.color, background: `${a.color}22`, padding: "3px 8px", borderRadius: 8 }}>{a.type === "banco" ? "Banco" : a.type === "efectivo" ? "Efectivo" : a.type}</span>
              </div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{a.name}</div>
              <div style={{ fontSize: 20, fontWeight: 800, margin: "2px 0", color: (engine.bal[a.id] || 0) < 0 ? C.orange : C.txt }}>{CLP(engine.bal[a.id] || 0)}</div>
              <div style={{ fontSize: 11, color: C.sub, fontWeight: 700 }}>SALDO{a.line ? ` · Línea disp. ${CLP(Math.max(0, (a.line || 0) - (engine.lineUsed[a.id] || 0)))}` : ""}</div>
              {(engine.lineUsed[a.id] || 0) > 0 && <div style={{ fontSize: 11, color: C.orange, fontWeight: 700, marginTop: 2 }}>Línea usada {CLP(engine.lineUsed[a.id])}</div>}
            </div>
          ))}
        </div>
      )}

      {/* deudas y cupos */}
      <SectionHead label="Deudas y cupos" count={deudas.length} accent={C.orange} />
      {deudas.length === 0 ? (
        <Card style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
          <span style={{ width: 40, height: 40, borderRadius: 12, background: C.tealSoft, color: C.green, display: "grid", placeItems: "center" }}>􀉪</span>
          <div><div style={{ fontWeight: 700 }}>Sin deudas activas</div><div style={{ color: C.sub, fontSize: 13 }}>Las tarjetas, créditos y líneas usadas aparecerán aquí.</div></div>
        </Card>
      ) : (
        <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 6, marginBottom: 18 }}>
          {deudas.map((a) => {
            const isCard = a.type === "tarjeta";
            const facturar = isCard ? engine.cardUsed[a.id] || 0 : engine.debt[a.id] || 0;
            return (
              <div key={a.id} onClick={() => setModal({ type: "accountDetail", accountId: a.id })} style={{ minWidth: 180, background: C.card, borderRadius: 18, padding: 16, border: `1px solid ${C.line}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                  <span style={{ fontSize: 20 }}>{isCard ? "💳" : "📄"}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: C.blue, background: C.blueSoft, padding: "3px 8px", borderRadius: 8 }}>{isCard ? `Cierra en ${a.cierre || 24} días` : a.vencMonth ? `Vence ${keyToLabel(a.vencMonth)}` : "Pendiente"}</span>
                </div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{a.name}</div>
                <div style={{ fontSize: 20, fontWeight: 800, margin: "2px 0", color: facturar > 0 ? C.orange : C.txt }}>{CLP(facturar)}</div>
                <div style={{ fontSize: 11, color: C.sub, fontWeight: 700 }}>{isCard ? "POR FACTURAR" : `${a.cuotasRestantes || 0} cuotas`}</div>
                <div style={{ fontSize: 11, color: C.sub, marginTop: 2 }}>{isCard ? `Cupo disp. ${CLP((a.cupo || 0) - facturar)}` : `Cuota ${CLP(a.cuotaValue || 0)}${a.pagoDia ? ` · día ${a.pagoDia}` : ""}`}</div>
              </div>
            );
          })}
        </div>
      )}

      {/* últimos movimientos */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Últimos movimientos</h2>
      </div>
      {recent.length === 0 ? (
        <Empty icon="🧾" title="Sin movimientos todavía" sub="Usa el botón + para registrar tu primer gasto o ingreso." />
      ) : (
        recent.map((m) => <MovRow key={m.id} m={m} acc={acc} />)
      )}
    </div>
  );
}

const SectionHead = ({ label, count, accent }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
    <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>{label}</h2>
    {count != null && <span style={{ width: 24, height: 24, borderRadius: 12, background: accent ? C.orangeSoft : C.tealSoft, color: accent || C.green, display: "grid", placeItems: "center", fontSize: 12, fontWeight: 700 }}>{count}</span>}
  </div>
);

function MovRow({ m, acc }) {
  const neg = ["gasto", "cuotaTC", "pagoTarjeta", "pagoCredito", "pagoLinea"].includes(m.kind);
  const isTransfer = m.kind === "transferencia";
  const label = isTransfer ? "Transferencia" : m.merchant || "Movimiento";
  const sub = isTransfer
    ? `${acc(m.fromId)?.name} → ${acc(m.toId)?.name}`
    : m.kind === "cuotaTC"
    ? `cuota ${m.cuotaIndex}/${m.cuotasTotal} · ${acc(m.accountId)?.name || ""}`
    : `${acc(m.accountId || m.fromId || m.cardId || m.creditId)?.name || ""}`;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, background: C.card, borderRadius: 16, padding: "12px 14px", marginBottom: 8, border: `1px solid ${C.line}` }}>
      <span style={{ width: 40, height: 40, borderRadius: 12, background: isTransfer ? C.blueSoft : neg ? C.redSoft : C.tealSoft, color: isTransfer ? C.blue : neg ? C.red : C.green, display: "grid", placeItems: "center", fontSize: 16 }}>
        {isTransfer ? "􀄭" : neg ? "􀍯" : "􀄩"}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</div>
        <div style={{ color: C.sub, fontSize: 12 }}>{sub}</div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ fontWeight: 800, color: neg ? C.red : isTransfer ? C.blue : C.green }}>{neg ? "-" : "+"}{CLP(m.amount)}</div>
        <div style={{ fontSize: 11, color: m.status === "cuadrado" ? C.blue : C.sub }}>{m.status === "cuadrado" ? "􀁢 Cuadrado" : m.status === "confirmado" ? "􀁢" : "􀐫 Pend."}</div>
      </div>
    </div>
  );
}

// ============================================================
//  CUENTAS
// ============================================================
function Cuentas({ accounts, engine, setModal }) {
  const groups = [
    { label: "Dinero y ahorro", types: ["efectivo", "banco", "ahorro", "inversion"] },
    { label: "Tarjetas", types: ["tarjeta"] },
    { label: "Créditos", types: ["credito"] },
  ];
  return (
    <div style={{ padding: "6px 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ fontSize: 17, margin: 0, flex: 1, textAlign: "center", paddingLeft: 40 }}>Cuentas</h1>
        <button onClick={() => setModal({ type: "newAccount" })} style={{ width: 40, height: 40, borderRadius: 20, background: C.tealSoft, border: `1px solid ${C.tealDim}`, color: C.green, fontSize: 22 }}>+</button>
      </div>

      <div style={{ borderRadius: 24, padding: 20, background: `linear-gradient(150deg,${C.tealDim},${C.blue})`, marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
          <span style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(255,255,255,.15)", display: "grid", placeItems: "center" }}>􀉉</span>
          <span style={{ background: "rgba(255,255,255,.15)", padding: "4px 12px", borderRadius: 12, fontSize: 13, fontWeight: 700 }}>{accounts.length} cuentas</span>
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, opacity: .8 }}>TOTAL CONFIRMADO</div>
        <div style={{ fontSize: 40, fontWeight: 800, margin: "2px 0 14px" }}>{CLP(engine.patrimonio)}</div>
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1, background: "rgba(255,255,255,.1)", borderRadius: 14, padding: "10px 14px" }}>
            <div style={{ fontSize: 12, opacity: .8 }}>Esperado</div><div style={{ fontWeight: 700 }}>{CLP(engine.patrimonio)}</div>
          </div>
          <div style={{ flex: 1, background: "rgba(255,255,255,.1)", borderRadius: 14, padding: "10px 14px" }}>
            <div style={{ fontSize: 12, opacity: .8 }}>Por confirmar</div><div style={{ fontWeight: 700 }}>{CLP(engine.patrimonio)}</div>
          </div>
        </div>
      </div>

      <h2 style={{ fontSize: 22, fontWeight: 800, marginBottom: 14 }}>Tus cuentas</h2>
      {accounts.length === 0 ? (
        <Empty icon="🏦" title="Aún no tienes cuentas" sub="Crea efectivo, banco, tarjetas o créditos para empezar." cta="Crear cuenta" onCta={() => setModal({ type: "newAccount" })} />
      ) : (
        groups.map((g) => {
          const list = accounts.filter((a) => g.types.includes(a.type));
          if (!list.length) return null;
          return (
            <div key={g.label} style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <Eyebrow>{g.label}</Eyebrow>
                <span style={{ fontSize: 12, color: C.sub }}>{list.length} cuenta{list.length > 1 ? "s" : ""}</span>
              </div>
              {list.map((a) => {
                const isCard = a.type === "tarjeta";
                const isCredit = a.type === "credito";
                const right = isCard ? engine.cardUsed[a.id] != null ? (a.cupo || 0) - engine.cardUsed[a.id] : a.cupo : isCredit ? engine.debt[a.id] : engine.bal[a.id];
                return (
                  <div key={a.id} onClick={() => setModal({ type: "accountDetail", accountId: a.id })} style={{ display: "flex", alignItems: "center", gap: 12, background: C.card, borderRadius: 16, padding: 16, marginBottom: 8, border: `1px solid ${C.line}` }}>
                    <span style={{ width: 44, height: 44, borderRadius: 12, background: `${a.color}22`, display: "grid", placeItems: "center", fontSize: 20 }}>{ACCOUNT_TYPES.find((t) => t.id === a.type)?.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 17 }}>{a.name}</div>
                      <div style={{ color: C.sub, fontSize: 13 }}>
                        {isCard ? `Tarjeta de crédito · cupo ${CLP(a.cupo || 0)}` : isCredit ? `Crédito · ${a.cuotasRestantes || 0} cuotas${a.vencMonth ? ` · vence ${keyToLabel(a.vencMonth)}` : ""}` : a.line ? `Línea disp. ${CLP(Math.max(0, (a.line || 0) - (engine.lineUsed[a.id] || 0)))}` : ACCOUNT_TYPES.find((t) => t.id === a.type)?.label}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 11, color: C.sub, fontWeight: 700 }}>{isCard ? "CUPO" : isCredit ? "PENDIENTE" : "BANCO"}</div>
                      <div style={{ fontWeight: 800, fontSize: 18, color: isCard ? C.green : isCredit ? C.orange : (right || 0) < 0 ? C.orange : C.txt }}>{CLP(right || 0)}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })
      )}
    </div>
  );
}

// ============================================================
//  MOVIMIENTOS
// ============================================================
function Movimientos({ movements, acc, cat, viewMonth, C }) {
  const [q, setQ] = useState("");
  const [range, setRange] = useState("mes");
  const list = movements.filter((m) => {
    if (range === "mes" && m.month !== viewMonth) return false;
    if (q) {
      const t = `${m.merchant} ${cat(m.categoryId)?.name || ""} ${acc(m.accountId || m.fromId)?.name || ""}`.toLowerCase();
      if (!t.includes(q.toLowerCase())) return false;
    }
    return true;
  });
  return (
    <div style={{ padding: "6px 16px" }}>
      <h1 style={{ textAlign: "center", fontSize: 17, margin: "4px 0 14px" }}>Movimientos</h1>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por comercio, nota o cuenta"
        style={{ width: "100%", boxSizing: "border-box", background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: "13px 16px", color: C.txt, fontSize: 15, marginBottom: 12 }} />
      <div style={{ display: "flex", background: C.card, borderRadius: 14, padding: 4, marginBottom: 14 }}>
        {[["todo", "Todo"], ["mes", "Este mes"], ["futuros", "Futuros"]].map(([id, l]) => (
          <button key={id} onClick={() => setRange(id)} style={{ flex: 1, border: "none", borderRadius: 11, padding: "9px 0", fontWeight: 700, fontSize: 14, background: range === id ? C.card2 : "transparent", color: range === id ? C.txt : C.sub }}>{l}</button>
        ))}
      </div>
      {list.length === 0 ? (
        <Empty icon="🧾" title="Sin movimientos" sub="Los gastos, ingresos y transferencias que registres aparecerán aquí." />
      ) : (
        list.map((m) => <MovRow key={m.id} m={m} acc={acc} />)
      )}
    </div>
  );
}

// ============================================================
//  PRESUPUESTO
// ============================================================
function Presupuesto({ categories, budgets, viewMonth, setViewMonth, movements, setModal, setBudgets, C }) {
  const monthBudget = budgets[viewMonth] || {};
  const asignado = Object.values(monthBudget).reduce((s, v) => s + v, 0);
  const gastado = movements.filter((m) => m.month === viewMonth && (m.kind === "gasto" || m.kind === "cuotaTC") && (m.status === "confirmado" || m.status === "cuadrado")).reduce((s, m) => s + m.amount, 0);
  const grupos = PRIORIDADES.map((p) => ({ ...p, cats: categories.filter((c) => c.type === "gasto" && c.prioridad === p.id) }));

  return (
    <div style={{ padding: "6px 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <h1 style={{ fontSize: 17, margin: 0 }}>Presupuesto</h1>
        <MonthNav value={viewMonth} onChange={setViewMonth} />
      </div>

      <div style={{ borderRadius: 24, padding: 20, background: `linear-gradient(150deg,${C.tealDim},${C.blue})`, marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, opacity: .85, marginBottom: 6 }}>􀋱 PLAN MENSUAL</div>
        <div style={{ fontSize: 14, opacity: .85 }}>Saldo por asignar</div>
        <div style={{ fontSize: 40, fontWeight: 800, marginBottom: 14 }}>{CLP(0)}</div>
        <div style={{ display: "flex", gap: 8 }}>
          {[["Disponible", 0], ["Asignado", asignado], ["Gastado", gastado]].map(([l, v]) => (
            <div key={l} style={{ flex: 1, background: "rgba(255,255,255,.1)", borderRadius: 12, padding: "10px 12px" }}>
              <div style={{ fontSize: 12, opacity: .8 }}>{l}</div><div style={{ fontWeight: 700 }}>{CLP(v)}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Categorías</h2>
        <button onClick={() => setModal({ type: "categories" })} style={{ background: C.tealSoft, border: `1px solid ${C.tealDim}`, color: C.green, padding: "8px 16px", borderRadius: 20, fontWeight: 700, fontSize: 14 }}>+ Nueva</button>
      </div>

      {categories.filter((c) => c.type === "gasto").length === 0 ? (
        <Empty icon="🏷️" title="Sin categorías todavía" sub="Crea categorías para ordenar tus gastos y asignar presupuesto." cta="Crear categoría" onCta={() => setModal({ type: "categories" })} />
      ) : (
        grupos.map((g) => g.cats.length ? (
          <div key={g.id} style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ color: g.color, fontWeight: 700 }}>􀇻 {g.label}</span>
              <span style={{ marginLeft: "auto", fontSize: 13, color: C.sub }}>{g.cats.length}</span>
            </div>
            {g.cats.map((c) => {
              const asig = monthBudget[c.id] || 0;
              const gas = movements.filter((m) => m.month === viewMonth && m.categoryId === c.id && (m.kind === "gasto" || m.kind === "cuotaTC")).reduce((s, m) => s + m.amount, 0);
              return (
                <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, background: C.card, borderRadius: 14, padding: 14, marginBottom: 8, border: `1px solid ${C.line}` }}>
                  <span style={{ width: 38, height: 38, borderRadius: 11, background: `${c.color}22`, display: "grid", placeItems: "center", fontSize: 17 }}>{c.icon || "🏷️"}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700 }}>{c.name}</div>
                    <div style={{ fontSize: 12, color: asig ? (gas > asig ? C.red : C.sub) : C.sub }}>{asig ? `${CLP(gas)} de ${CLP(asig)}` : "Sin presupuesto este mes"}</div>
                  </div>
                  <button onClick={() => {
                    const v = prompt(`Asignar presupuesto a ${c.name} (${keyToLabel(viewMonth)})`, asig || "");
                    if (v != null) setBudgets((p) => ({ ...p, [viewMonth]: { ...(p[viewMonth] || {}), [c.id]: Math.max(0, Number(v) || 0) } }));
                  }} style={{ background: "none", border: "none", color: C.teal, fontWeight: 700, fontSize: 14 }}>{asig ? "Editar" : "Asignar"}</button>
                </div>
              );
            })}
          </div>
        ) : null)
      )}
    </div>
  );
}

// ============================================================
//  MÁS
// ============================================================
function Mas({ accounts, categories, movements, exportCSV, setModal, C }) {
  return (
    <div style={{ padding: "6px 16px" }}>
      <div style={{ borderRadius: 24, padding: 20, background: `linear-gradient(150deg,${C.tealDim},${C.blue})`, marginBottom: 16 }}>
        <div style={{ fontSize: 32, fontWeight: 800, marginBottom: 2 }}>Centro de control</div>
        <div style={{ opacity: .8, fontSize: 13, marginBottom: 16 }}>Local en este dispositivo</div>
        <div style={{ display: "flex", gap: 8 }}>
          {[["Cuentas", accounts.length], ["Categorías", categories.length], ["Movimientos", movements.length]].map(([l, v]) => (
            <div key={l} style={{ flex: 1, background: "rgba(255,255,255,.12)", borderRadius: 14, padding: "12px 10px" }}>
              <div style={{ fontSize: 12, opacity: .85 }}>{l}</div><div style={{ fontSize: 22, fontWeight: 800 }}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      <Card onClick={() => setModal({ type: "scheduled" })} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16, cursor: "pointer" }}>
        <span style={{ width: 44, height: 44, borderRadius: 12, background: C.tealSoft, color: C.green, display: "grid", placeItems: "center", fontSize: 18 }}>􀉉</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700 }}>Programados</div>
          <div style={{ color: C.sub, fontSize: 13 }}>Sueldo, arriendo y pagos fijos</div>
          <div style={{ color: C.green, fontSize: 13, fontWeight: 700, marginTop: 2 }}>􀎡 Nada toca saldos hasta que confirmas</div>
        </div>
        <span style={{ color: C.faint }}>›</span>
      </Card>

      <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 2 }}>Preferencias</h2>
      <div style={{ color: C.sub, fontSize: 13, marginBottom: 12 }}>Datos y respaldo</div>

      <Card style={{ padding: 0, overflow: "hidden" }}>
        {[
          ["🌎", "Moneda principal", "CLP · Peso Chileno", null],
          ["🏷️", "Categorías", `${categories.length} activas`, () => setModal({ type: "categories" })],
          ["📊", "Pulso Cuadra", "Esperado vs Real", () => setModal({ type: "pulse" })],
          ["📤", "Exportar a Excel/CSV", "Descarga tus movimientos", exportCSV],
        ].map(([ic, title, sub, fn], i, arr) => (
          <div key={title} onClick={fn || undefined} style={{ display: "flex", alignItems: "center", gap: 14, padding: 16, borderBottom: i < arr.length - 1 ? `1px solid ${C.line}` : "none", cursor: fn ? "pointer" : "default" }}>
            <span style={{ width: 40, height: 40, borderRadius: 12, background: C.card2, display: "grid", placeItems: "center", fontSize: 18 }}>{ic}</span>
            <div style={{ flex: 1 }}><div style={{ fontWeight: 700 }}>{title}</div><div style={{ color: C.sub, fontSize: 13 }}>{sub}</div></div>
            <span style={{ color: C.faint }}>›</span>
          </div>
        ))}
      </Card>

      <div style={{ textAlign: "center", color: C.faint, fontSize: 12, marginTop: 20 }}>
        Réplica funcional · datos en memoria (se pierden al recargar).<br />La versión con nube usará Supabase.
      </div>
    </div>
  );
}

// ============================================================
//  MODALES
// ============================================================
function Sheet({ title, close, children, footer }) {
  return (
    <div onClick={close} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 70, display: "flex", alignItems: "flex-end" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxHeight: "92%", background: C.bg2, borderTopLeftRadius: 26, borderTopRightRadius: 26, border: `1px solid ${C.line}`, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", padding: "16px 18px", borderBottom: `1px solid ${C.line}` }}>
          <button onClick={close} style={{ background: "none", border: "none", color: C.teal, fontSize: 16, fontWeight: 600 }}>Cerrar</button>
          <div style={{ flex: 1, textAlign: "center", fontWeight: 700, fontSize: 17, marginRight: 50 }}>{title}</div>
        </div>
        <div style={{ overflowY: "auto", padding: 18, flex: 1 }}>{children}</div>
        {footer && <div style={{ padding: 16, borderTop: `1px solid ${C.line}` }}>{footer}</div>}
      </div>
    </div>
  );
}

const Field = ({ label, children }) => (
  <div style={{ marginBottom: 14 }}>
    <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: .5, color: C.sub, textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
    {children}
  </div>
);
const input = { width: "100%", boxSizing: "border-box", background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: "13px 16px", color: C.txt, fontSize: 16 };
const primaryBtn = (disabled) => ({ width: "100%", background: disabled ? C.card2 : C.teal, border: "none", color: disabled ? C.faint : "#fff", padding: "16px 0", borderRadius: 16, fontWeight: 800, fontSize: 16 });

function Modal({ shared, modal, close }) {
  const t = modal.type;
  if (t === "newAccount") return <NewAccount shared={shared} close={close} />;
  if (t === "categories") return <Categories shared={shared} close={close} />;
  if (t === "quick") return <QuickAdd shared={shared} close={close} />;
  if (t === "cardPurchase") return <CardPurchase shared={shared} close={close} />;
  if (t === "payCard") return <PayCard shared={shared} close={close} />;
  if (t === "payCredit") return <PayCredit shared={shared} close={close} />;
  if (t === "payLine") return <PayLine shared={shared} close={close} />;
  if (t === "pulse") return <Pulse shared={shared} close={close} />;
  if (t === "scheduled") return <Scheduled shared={shared} close={close} />;
  if (t === "accountDetail") return <AccountDetail shared={shared} accountId={modal.accountId} close={close} />;
  return null;
}

// ---- Nueva cuenta ----
function NewAccount({ shared, close }) {
  const [type, setType] = useState("efectivo");
  const [name, setName] = useState("");
  const [initial, setInitial] = useState("");
  const [cupo, setCupo] = useState("");
  const [line, setLine] = useState("");
  const [cierre, setCierre] = useState("");
  const [venc, setVenc] = useState("");
  const [cuotaValue, setCuotaValue] = useState("");
  const [cuotasRestantes, setCuotasRestantes] = useState("1");
  const [pagoDia, setPagoDia] = useState("");
  const [vencMonth, setVencMonth] = useState(todayKey());
  const [color, setColor] = useState(C.teal);
  const meta = ACCOUNT_TYPES.find((x) => x.id === type);
  const palette = [C.teal, C.blue, C.violet, C.green, C.orange, C.red];

  const valid = name.trim() && (type !== "tarjeta" || cupo) && (type !== "credito" || (cuotaValue && cuotasRestantes));
  const create = () => {
    shared.addAccount({
      type, name: name.trim(), color,
      initial: Number(initial) || 0,
      cupo: Number(cupo) || 0,
      line: Number(line) || 0,
      cierre: Number(cierre) || 24,
      venc: Number(venc) || 0,
      cuotaValue: Number(cuotaValue) || 0,
      cuotasRestantes: Number(cuotasRestantes) || 0,
      pagoDia: Number(pagoDia) || 0,
      vencMonth,
    });
    close();
  };

  return (
    <Sheet title="Nueva cuenta" close={close} footer={<button disabled={!valid} onClick={create} style={primaryBtn(!valid)}>Crear cuenta</button>}>
      <Field label="Tipo de cuenta">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {ACCOUNT_TYPES.map((x) => (
            <button key={x.id} onClick={() => { setType(x.id); setColor(x.color); }} style={{ textAlign: "left", background: type === x.id ? `${x.color}22` : C.card, border: `1.5px solid ${type === x.id ? x.color : C.line}`, borderRadius: 14, padding: 14, color: C.txt }}>
              <div style={{ fontSize: 20, marginBottom: 6 }}>{x.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{x.label}</div>
              <div style={{ color: C.sub, fontSize: 12 }}>{x.sub}</div>
            </button>
          ))}
        </div>
      </Field>

      <Field label="Nombre"><input style={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. TC Chile, Efectivo, Mach" /></Field>

      <Field label="Color de cuenta">
        <div style={{ display: "flex", gap: 10 }}>
          {palette.map((c) => (
            <button key={c} onClick={() => setColor(c)} style={{ width: 36, height: 36, borderRadius: 18, background: c, border: color === c ? "3px solid #fff" : "none" }} />
          ))}
        </div>
      </Field>

      {meta.kind === "money" && (
        <Field label="Saldo inicial (lo que ves hoy)"><input style={input} type="number" value={initial} onChange={(e) => setInitial(e.target.value)} placeholder="0" /></Field>
      )}
      {type === "banco" && (
        <Field label="Línea disponible (opcional)"><input style={input} type="number" value={line} onChange={(e) => setLine(e.target.value)} placeholder="0" /></Field>
      )}
      {type === "tarjeta" && (
        <>
          <Field label="Cupo total"><input style={input} type="number" value={cupo} onChange={(e) => setCupo(e.target.value)} placeholder="5.000.000" /></Field>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}><Field label="Día cierre"><input style={input} type="number" value={cierre} onChange={(e) => setCierre(e.target.value)} placeholder="Día 1" /></Field></div>
            <div style={{ flex: 1 }}><Field label="Día venc."><input style={input} type="number" value={venc} onChange={(e) => setVenc(e.target.value)} placeholder="Día 10" /></Field></div>
          </div>
        </>
      )}
      {type === "credito" && (
        <>
          <div style={{ background: C.orangeSoft, borderRadius: 14, padding: 14, marginBottom: 14, fontSize: 13, color: C.sub }}>Ingresa el valor de la cuota y cuántas quedan. Cuadra calcula el total por pagar.</div>
          <Field label="Valor cuota"><input style={input} type="number" value={cuotaValue} onChange={(e) => setCuotaValue(e.target.value)} placeholder="500.000" /></Field>
          <Field label="Cuotas restantes"><input style={input} type="number" value={cuotasRestantes} onChange={(e) => setCuotasRestantes(e.target.value)} placeholder="6" /></Field>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}><Field label="Día de pago"><input style={input} type="number" value={pagoDia} onChange={(e) => setPagoDia(e.target.value)} placeholder="Día 5" /></Field></div>
            <div style={{ flex: 1.4 }}><Field label="Próximo vencimiento"><MonthNav value={vencMonth} onChange={setVencMonth} /></Field></div>
          </div>
          <div style={{ background: C.card, borderRadius: 14, padding: 14, display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ width: 40, height: 40, borderRadius: 12, background: C.orangeSoft, color: C.orange, display: "grid", placeItems: "center" }}>ƒ(x)</span>
            <div><div style={{ fontSize: 11, color: C.sub, fontWeight: 700 }}>TOTAL POR PAGAR</div><div style={{ fontSize: 22, fontWeight: 800, color: C.orange }}>{CLP((Number(cuotaValue) || 0) * (Number(cuotasRestantes) || 0))}</div></div>
          </div>
        </>
      )}
    </Sheet>
  );
}

// ---- Categorías ----
function Categories({ shared, close }) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState("gasto");
  const [prioridad, setPrioridad] = useState("necesidades");
  const [icon, setIcon] = useState("🏷️");
  const [color, setColor] = useState(C.teal);
  const icons = ["🏷️","🏠","🍔","🚗","💡","🛒","🎬","💧","👕","☕","💊","🎁","📱","✈️","💰","🐾"];
  const palette = [C.teal, C.blue, C.violet, C.green, C.orange, C.red];

  const create = () => {
    if (!name.trim()) return;
    shared.addCategory({ name: name.trim(), type, prioridad: type === "gasto" ? prioridad : "obligaciones", icon, color });
    setName(""); setCreating(false);
  };

  return (
    <Sheet title={creating ? "Nueva categoría" : "Categorías"} close={close}
      footer={creating ? <button onClick={create} style={primaryBtn(!name.trim())}>Crear categoría</button> : <button onClick={() => setCreating(true)} style={primaryBtn(false)}>+ Nueva categoría</button>}>
      {creating ? (
        <>
          <Field label="Nombre"><input style={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Bencina" autoFocus /></Field>
          <Field label="Tipo">
            <div style={{ display: "flex", gap: 10 }}>
              {[["gasto", "􀄨 Gasto"], ["ingreso", "􀄩 Ingreso"]].map(([id, l]) => (
                <button key={id} onClick={() => setType(id)} style={{ flex: 1, background: type === id ? C.teal : C.card, border: `1px solid ${type === id ? C.teal : C.line}`, color: type === id ? "#fff" : C.green, padding: "13px 0", borderRadius: 14, fontWeight: 700 }}>{l}</button>
              ))}
            </div>
          </Field>
          {type === "gasto" && (
            <Field label="Prioridad">
              <div style={{ display: "flex", gap: 8 }}>
                {PRIORIDADES.map((p) => (
                  <button key={p.id} onClick={() => setPrioridad(p.id)} style={{ flex: 1, background: prioridad === p.id ? p.color : C.card, border: `1px solid ${prioridad === p.id ? p.color : C.line}`, color: prioridad === p.id ? "#fff" : p.color, padding: "12px 4px", borderRadius: 12, fontWeight: 700, fontSize: 13 }}>{p.label}</button>
                ))}
              </div>
            </Field>
          )}
          <Field label="Ícono">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {icons.map((i) => (
                <button key={i} onClick={() => setIcon(i)} style={{ width: 46, height: 46, borderRadius: 12, fontSize: 20, background: icon === i ? `${color}33` : C.card, border: `1.5px solid ${icon === i ? color : C.line}` }}>{i}</button>
              ))}
            </div>
          </Field>
          <Field label="Color">
            <div style={{ display: "flex", gap: 10 }}>
              {palette.map((c) => <button key={c} onClick={() => setColor(c)} style={{ width: 36, height: 36, borderRadius: 18, background: c, border: color === c ? "3px solid #fff" : "none" }} />)}
            </div>
          </Field>
        </>
      ) : (
        shared.categories.length === 0 ? (
          <div style={{ textAlign: "center", color: C.sub, padding: 30 }}>Aún no tienes categorías.<br />Crea la primera abajo.</div>
        ) : (
          PRIORIDADES.map((p) => {
            const list = shared.categories.filter((c) => (c.type === "gasto" ? c.prioridad === p.id : false));
            const ing = p.id === "obligaciones" ? shared.categories.filter((c) => c.type === "ingreso") : [];
            const all = [...list, ...ing];
            if (!all.length) return null;
            return (
              <div key={p.id} style={{ marginBottom: 16 }}>
                <div style={{ color: p.color, fontWeight: 700, marginBottom: 8 }}>{p.label}{p.id === "obligaciones" && ing.length ? " / Ingresos" : ""}</div>
                {all.map((c) => (
                  <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, background: C.card, borderRadius: 12, padding: 12, marginBottom: 6, border: `1px solid ${C.line}` }}>
                    <span style={{ width: 38, height: 38, borderRadius: 11, background: `${c.color}22`, display: "grid", placeItems: "center", fontSize: 17 }}>{c.icon}</span>
                    <div><div style={{ fontWeight: 700 }}>{c.name}</div><div style={{ fontSize: 12, color: C.sub }}>{c.type === "gasto" ? "Gasto" : "Ingreso"} · {PRIORIDADES.find((x) => x.id === c.prioridad)?.label}</div></div>
                  </div>
                ))}
              </div>
            );
          })
        )
      )}
    </Sheet>
  );
}

// ---- Registro rápido ----
function QuickAdd({ shared, close }) {
  const [raw, setRaw] = useState("");
  const [type, setType] = useState("gasto");
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState(shared.accounts.find((a) => a.type !== "tarjeta" && a.type !== "credito")?.id || "");
  const [categoryId, setCategoryId] = useState("");
  const [merchant, setMerchant] = useState("");
  const [status, setStatus] = useState("confirmado");

  // NLP simple: "Uber 8.500"
  useEffect(() => {
    const m = raw.match(/([\d.]+)/);
    if (m) setAmount(m[1].replace(/\./g, ""));
    const words = raw.replace(/[\d.]+/g, "").trim();
    if (words) setMerchant(words);
  }, [raw]);

  const cats = shared.categories.filter((c) => c.type === type);
  const moneyAcc = shared.accounts.filter((a) => a.type !== "tarjeta" && a.type !== "credito");
  const valid = amount && accountId;
  const save = () => {
    shared.addMovement({ kind: type, amount: Number(amount), accountId, categoryId, merchant: merchant || (type === "gasto" ? "Gasto" : "Ingreso"), month: todayKey(), status });
    close();
  };

  return (
    <Sheet title="Registro rápido" close={close} footer={<button disabled={!valid} onClick={save} style={primaryBtn(!valid)}>Guardar {type}</button>}>
      <Field label="Anota el movimiento">
        <input style={input} value={raw} onChange={(e) => setRaw(e.target.value)} placeholder="Ej: Uber 8.500" autoFocus />
      </Field>
      <div style={{ background: C.card, borderRadius: 16, padding: 16, border: `1px solid ${C.line}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
          <span style={{ fontWeight: 700 }}>Cuadra entendió</span>
          <span style={{ color: valid ? C.green : C.orange, fontWeight: 700 }}>{valid ? "Listo" : "Falta monto"}</span>
        </div>
        <RowSelect label="Tipo" value={type === "gasto" ? "Gasto" : "Ingreso"} onClick={() => setType(type === "gasto" ? "ingreso" : "gasto")} />
        <Field label="Monto"><input style={input} type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" /></Field>
        <Field label="Cuenta">
          {moneyAcc.length === 0 ? (
            <div style={{ background: C.orangeSoft, borderRadius: 12, padding: 13, fontSize: 13, color: C.txt, lineHeight: 1.45 }}>
              No tienes cuentas de dinero (efectivo, banco o ahorro).
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button onClick={() => { close(); shared.setModal({ type: "newAccount" }); }} style={{ flex: 1, background: C.teal, border: "none", color: "#fff", padding: "10px 0", borderRadius: 10, fontWeight: 700, fontSize: 13 }}>Crear cuenta</button>
                <button onClick={() => { close(); shared.setModal({ type: "cardPurchase" }); }} style={{ flex: 1, background: C.card2, border: `1px solid ${C.line}`, color: C.txt, padding: "10px 0", borderRadius: 10, fontWeight: 700, fontSize: 13 }}>Usar Gasto TC</button>
              </div>
              <div style={{ marginTop: 8, color: C.sub, fontSize: 12 }}>Los gastos con tarjeta van por “Gasto TC” para descontar cupo y armar las cuotas.</div>
            </div>
          ) : (
            <select style={{ ...input, appearance: "none" }} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="">Elegir cuenta</option>
              {moneyAcc.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          )}
        </Field>
        <Field label="Categoría">
          <select style={{ ...input, appearance: "none" }} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Sin categoría</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
          </select>
        </Field>
        <Field label="Estado">
          <div style={{ display: "flex", gap: 8 }}>
            {[["confirmado", "Confirmado"], ["pendiente", "Pendiente"]].map(([id, l]) => (
              <button key={id} onClick={() => setStatus(id)} style={{ flex: 1, background: status === id ? C.tealSoft : C.card2, border: `1px solid ${status === id ? C.teal : C.line}`, color: status === id ? C.green : C.sub, padding: "11px 0", borderRadius: 12, fontWeight: 700 }}>{l}</button>
            ))}
          </div>
        </Field>
      </div>
    </Sheet>
  );
}
const RowSelect = ({ label, value, onClick }) => (
  <button onClick={onClick} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", background: C.card2, border: `1px solid ${C.line}`, borderRadius: 14, padding: "13px 16px", color: C.txt, marginBottom: 12 }}>
    <span><span style={{ fontSize: 12, color: C.sub, display: "block", textAlign: "left" }}>{label}</span><span style={{ fontWeight: 700 }}>{value}</span></span>
    <span style={{ color: C.faint }}>􀄬</span>
  </button>
);

// ---- Compra con tarjeta (cuotas) ----
function CardPurchase({ shared, close }) {
  const cards = shared.accounts.filter((a) => a.type === "tarjeta");
  const [cardId, setCardId] = useState(cards[0]?.id || "");
  const [merchant, setMerchant] = useState("");
  const [total, setTotal] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [cuotas, setCuotas] = useState(1);
  const [firstNow, setFirstNow] = useState(true);
  const [enCurso, setEnCurso] = useState(false);
  const [curIndex, setCurIndex] = useState(1); // próxima cuota a facturar
  const [note, setNote] = useState("");
  const gastoCats = shared.categories.filter((c) => c.type === "gasto");
  const card = shared.accounts.find((a) => a.id === cardId);
  const cupoDisp = card ? (card.cupo || 0) - (shared.engine.cardUsed[cardId] || 0) : 0;
  const per = total ? Math.floor(Number(total) / cuotas) : 0;
  const startIndex = enCurso ? Math.min(Math.max(1, curIndex), cuotas) : 1;
  const cuotasRestantes = cuotas - (startIndex - 1);
  const montoRestante = per * cuotasRestantes + (Number(total) ? Number(total) - per * cuotas : 0); // falta facturar (la 1ª cuota creada lleva el remanente)

  if (!cards.length) return <Sheet title="Gasto con tarjeta" close={close}><Empty icon="💳" title="No tienes tarjetas" sub="Crea una tarjeta de crédito primero desde Cuentas." /></Sheet>;

  const valid = total && cardId && montoRestante <= cupoDisp && startIndex <= cuotas;
  const save = () => {
    const firstMonth = firstNow ? todayKey() : addMonths(todayKey(), 1);
    shared.registerCardPurchase({ cardId, merchant: merchant || "Compra", categoryId, total: Number(total), cuotas, firstMonth, note, startIndex });
    close();
  };

  return (
    <Sheet title="Gasto con tarjeta de crédito" close={close} footer={<button disabled={!valid} onClick={save} style={primaryBtn(!valid)}>Registrar compra</button>}>
      <div style={{ background: C.card, borderRadius: 16, padding: 16, marginBottom: 14, border: `1px solid ${C.line}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <span style={{ width: 42, height: 42, borderRadius: 12, background: C.tealSoft, color: C.green, display: "grid", placeItems: "center", fontSize: 18 }}>􀍯</span>
          <div><div style={{ fontWeight: 700 }}>Compra con tarjeta</div><div style={{ color: C.sub, fontSize: 13 }}>Cupo, cuotas y presupuesto en una sola vista.</div></div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <MiniStat label="Tarjeta" value={card?.name || "—"} />
          <MiniStat label="Plan" value={`${cuotas} ${cuotas === 1 ? "cuota" : "cuotas"} · ${firstNow ? "ahora" : "diferida"}`} />
          <MiniStat label="Cupo disp." value={CLP(cupoDisp)} />
          <MiniStat label="Cuota" value={CLP(per)} />
        </div>
      </div>

      <Field label="Tarjeta">
        <select style={{ ...input, appearance: "none" }} value={cardId} onChange={(e) => setCardId(e.target.value)}>
          {cards.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </Field>
      <Field label="Comercio"><input style={input} value={merchant} onChange={(e) => setMerchant(e.target.value)} placeholder="Ej. Supermercado, restaurante" /></Field>
      <Field label="Monto total"><input style={input} type="number" value={total} onChange={(e) => setTotal(e.target.value)} placeholder="0" /></Field>
      {total && montoRestante > cupoDisp && <div style={{ background: C.redSoft, color: C.red, borderRadius: 12, padding: 12, fontSize: 13, marginBottom: 12 }}>⚠ Lo que falta facturar ({CLP(montoRestante)}) excede el cupo disponible ({CLP(cupoDisp)}).</div>}
      <Field label="Categoría">
        <select style={{ ...input, appearance: "none" }} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">Sin categoría</option>
          {gastoCats.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
        </select>
      </Field>

      <Field label="Plan de pago">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 10 }}>
          {[1, 2, 3, 6, 12, 18, 24, 36].map((n) => (
            <button key={n} onClick={() => setCuotas(n)} style={{ background: cuotas === n ? C.teal : C.card, border: `1px solid ${cuotas === n ? C.teal : C.line}`, color: cuotas === n ? "#fff" : C.txt, padding: "12px 0", borderRadius: 12, fontWeight: 700, fontSize: 14 }}>{n}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setFirstNow(true)} style={{ flex: 1, background: firstNow ? C.tealSoft : C.card, border: `1px solid ${firstNow ? C.teal : C.line}`, color: firstNow ? C.green : C.sub, padding: "12px 0", borderRadius: 12, fontWeight: 700 }}>Primera: Ahora</button>
          <button onClick={() => setFirstNow(false)} style={{ flex: 1, background: !firstNow ? C.tealSoft : C.card, border: `1px solid ${!firstNow ? C.teal : C.line}`, color: !firstNow ? C.green : C.sub, padding: "12px 0", borderRadius: 12, fontWeight: 700 }}>Diferida (+1 mes)</button>
        </div>
      </Field>

      {/* compra ya en curso */}
      <Field label="¿Es una compra ya en curso?">
        <div style={{ display: "flex", gap: 8, marginBottom: enCurso ? 12 : 0 }}>
          <button onClick={() => setEnCurso(false)} style={{ flex: 1, background: !enCurso ? C.tealSoft : C.card, border: `1px solid ${!enCurso ? C.teal : C.line}`, color: !enCurso ? C.green : C.sub, padding: "12px 0", borderRadius: 12, fontWeight: 700 }}>Compra nueva</button>
          <button onClick={() => setEnCurso(true)} style={{ flex: 1, background: enCurso ? C.orangeSoft : C.card, border: `1px solid ${enCurso ? C.orange : C.line}`, color: enCurso ? C.orange : C.sub, padding: "12px 0", borderRadius: 12, fontWeight: 700 }}>Ya voy pagando</button>
        </div>
        {enCurso && (
          <div style={{ background: C.orangeSoft, borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: 13, color: C.sub, marginBottom: 10 }}>Indica la próxima cuota a facturar. Cuadra cargará solo las que faltan hacia adelante.</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 700 }}>Próxima cuota</span>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <button onClick={() => setCurIndex((v) => Math.max(1, v - 1))} style={{ width: 34, height: 34, borderRadius: 17, background: C.card, border: `1px solid ${C.line}`, color: C.txt, fontSize: 18 }}>−</button>
                <span style={{ fontWeight: 800, fontSize: 18, minWidth: 60, textAlign: "center" }}>{startIndex} / {cuotas}</span>
                <button onClick={() => setCurIndex((v) => Math.min(cuotas, v + 1))} style={{ width: 34, height: 34, borderRadius: 17, background: C.card, border: `1px solid ${C.line}`, color: C.txt, fontSize: 18 }}>+</button>
              </div>
            </div>
            <div style={{ fontSize: 13, color: C.orange, marginTop: 10, fontWeight: 700 }}>
              Faltan {cuotasRestantes} cuota{cuotasRestantes !== 1 ? "s" : ""} · {CLP(montoRestante)} por facturar
            </div>
          </div>
        )}
      </Field>

      {total && (
        <div style={{ background: C.blueSoft, borderRadius: 14, padding: 14, marginBottom: 8 }}>
          <div style={{ fontWeight: 700, marginBottom: 8, color: C.blue }}>􀉉 Cuotas por venir</div>
          {Array.from({ length: Math.min(cuotasRestantes, 4) }).map((_, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginBottom: 4 }}>
              <span style={{ color: C.sub }}>Cuota {startIndex + i}/{cuotas} · {keyToLabel(addMonths(firstNow ? todayKey() : addMonths(todayKey(), 1), i))}{i === 0 && firstNow ? " · Este mes" : ""}</span>
              <span style={{ fontWeight: 700 }}>{CLP(per + (i === 0 ? Number(total) - per * cuotas : 0))}</span>
            </div>
          ))}
          {cuotasRestantes > 4 && <div style={{ fontSize: 12, color: C.faint }}>+ {cuotasRestantes - 4} cuotas más…</div>}
        </div>
      )}
      <Field label="Nota"><input style={input} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej. Cuotas sin interés" /></Field>
    </Sheet>
  );
}
const MiniStat = ({ label, value }) => (
  <div style={{ background: C.card2, borderRadius: 12, padding: "10px 12px" }}>
    <div style={{ fontSize: 11, color: C.sub, fontWeight: 700, textTransform: "uppercase" }}>{label}</div>
    <div style={{ fontWeight: 700, fontSize: 14 }}>{value}</div>
  </div>
);

// ---- Pagar tarjeta ----
function PayCard({ shared, close }) {
  const cards = shared.accounts.filter((a) => a.type === "tarjeta");
  const money = shared.accounts.filter((a) => a.type !== "tarjeta" && a.type !== "credito");
  const [cardId, setCardId] = useState(cards[0]?.id || "");
  const [fromId, setFromId] = useState(money[0]?.id || "");
  const [amount, setAmount] = useState("");
  const facturar = shared.engine.cardUsed[cardId] || 0;
  const real = shared.engine.bal[fromId] || 0;
  const disp = shared.engine.avail[fromId] || 0; // real + línea disponible
  const fromAcc = shared.accounts.find((a) => a.id === fromId);

  if (!cards.length) return <Sheet title="Pagar tarjeta" close={close}><Empty icon="💳" title="No tienes tarjetas" sub="Crea una tarjeta primero." /></Sheet>;
  const n = Number(amount) || 0;
  const usaLinea = n > real; // parte del pago sale de la línea
  const lineaUsada = usaLinea ? Math.min(n - real, (fromAcc?.line || 0)) : 0;
  const valid = amount && n <= disp && fromId;
  const save = () => { shared.payCard({ cardId, fromId, amount: n }); close(); };

  return (
    <Sheet title="Pagar tarjeta de crédito" close={close} footer={<button disabled={!valid} onClick={save} style={primaryBtn(!valid)}>{valid ? "Registrar pago" : "Excede saldo + línea"}</button>}>
      <div style={{ background: C.card, borderRadius: 16, padding: 16, marginBottom: 14, border: `1px solid ${C.line}` }}>
        <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 4 }}>Pago de factura</div>
        <div style={{ color: C.sub, fontSize: 13 }}>Baja la deuda de la tarjeta y descuenta dinero de la cuenta origen. No es un gasto nuevo.</div>
      </div>
      <Field label="Tarjeta a pagar">
        <select style={{ ...input, appearance: "none" }} value={cardId} onChange={(e) => setCardId(e.target.value)}>
          {cards.map((a) => <option key={a.id} value={a.id}>{a.name} — por facturar {CLP(shared.engine.cardUsed[a.id] || 0)}</option>)}
        </select>
      </Field>
      <Field label="Pagar desde">
        <select style={{ ...input, appearance: "none" }} value={fromId} onChange={(e) => setFromId(e.target.value)}>
          {money.map((a) => {
            const r = shared.engine.bal[a.id] || 0;
            const av = shared.engine.avail[a.id] || 0;
            const extra = av > r ? ` (+línea ${CLP(av - r)})` : "";
            return <option key={a.id} value={a.id}>{a.name} — disp. {CLP(r)}{extra}</option>;
          })}
        </select>
      </Field>
      <Field label="Monto"><input style={input} type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={String(facturar || 0)} /></Field>
      {usaLinea && n <= disp && (
        <div style={{ background: C.blueSoft, color: C.blue, borderRadius: 12, padding: 12, fontSize: 13 }}>􀋦 Usarás {CLP(lineaUsada)} de la línea de {fromAcc?.name}. El saldo quedará en {CLP(real - n)} (línea usada). Podrás pagar esa línea después con dinero real.</div>
      )}
      {n > disp && <div style={{ background: C.redSoft, color: C.red, borderRadius: 12, padding: 12, fontSize: 13 }}>⚠ Excede saldo + línea. Máximo disponible: {CLP(disp)}.</div>}
    </Sheet>
  );
}

// ---- Pagar crédito ----
function PayCredit({ shared, close }) {
  const credits = shared.accounts.filter((a) => a.type === "credito");
  const money = shared.accounts.filter((a) => a.type !== "tarjeta" && a.type !== "credito");
  const [creditId, setCreditId] = useState(credits[0]?.id || "");
  const [fromId, setFromId] = useState(money[0]?.id || "");
  const credit = shared.accounts.find((a) => a.id === creditId);
  const [amount, setAmount] = useState(credit?.cuotaValue ? String(credit.cuotaValue) : "");
  const real = shared.engine.bal[fromId] || 0;
  const disp = shared.engine.avail[fromId] || 0;
  const pend = shared.engine.debt[creditId] || 0;
  const fromAcc = shared.accounts.find((a) => a.id === fromId);

  if (!credits.length) return <Sheet title="Pagar crédito" close={close}><Empty icon="📄" title="No tienes créditos" sub="Crea un crédito primero desde Cuentas." /></Sheet>;
  const n = Number(amount) || 0;
  const usaLinea = n > real;
  const lineaUsada = usaLinea ? Math.min(n - real, (fromAcc?.line || 0)) : 0;
  const valid = amount && n <= disp && fromId;
  const save = () => { shared.payCredit({ creditId, fromId, amount: n }); close(); };

  return (
    <Sheet title="Pagar crédito" close={close} footer={<button disabled={!valid} onClick={save} style={primaryBtn(!valid)}>{valid ? "Registrar pago" : "Excede saldo + línea"}</button>}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.sub, letterSpacing: 1 }}>DEUDA PENDIENTE</div>
        <div style={{ fontSize: 38, fontWeight: 800, color: C.teal }}>{CLP(pend)}</div>
        <div style={{ color: C.sub, fontSize: 13 }}>Cuota {CLP(credit?.cuotaValue || 0)} · Restan {credit?.cuotasRestantes || 0} cuotas</div>
      </div>
      <Field label="Crédito">
        <select style={{ ...input, appearance: "none" }} value={creditId} onChange={(e) => setCreditId(e.target.value)}>
          {credits.map((a) => <option key={a.id} value={a.id}>{a.name} — pend. {CLP(shared.engine.debt[a.id] || 0)}</option>)}
        </select>
      </Field>
      <Field label="Pagar desde">
        <select style={{ ...input, appearance: "none" }} value={fromId} onChange={(e) => setFromId(e.target.value)}>
          {money.map((a) => {
            const r = shared.engine.bal[a.id] || 0;
            const av = shared.engine.avail[a.id] || 0;
            const extra = av > r ? ` (+línea ${CLP(av - r)})` : "";
            return <option key={a.id} value={a.id}>{a.name} — disp. {CLP(r)}{extra}</option>;
          })}
        </select>
      </Field>
      <Field label="Monto"><input style={input} type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={String(credit?.cuotaValue || 0)} /></Field>
      {usaLinea && n <= disp && (
        <div style={{ background: C.blueSoft, color: C.blue, borderRadius: 12, padding: 12, fontSize: 13 }}>􀋦 Usarás {CLP(lineaUsada)} de la línea de {fromAcc?.name}. El saldo quedará en {CLP(real - n)} (línea usada).</div>
      )}
      {n > disp && <div style={{ background: C.redSoft, color: C.red, borderRadius: 12, padding: 12, fontSize: 13 }}>⚠ Excede saldo + línea. Máximo disponible: {CLP(disp)}.</div>}
    </Sheet>
  );
}

// ---- Pagar línea usada ----
function PayLine({ shared, close }) {
  // bancos con línea usada (saldo negativo)
  const banks = shared.accounts.filter((a) => (shared.engine.lineUsed[a.id] || 0) > 0);
  const money = shared.accounts.filter((a) => a.type !== "tarjeta" && a.type !== "credito");
  const [bankId, setBankId] = useState(banks[0]?.id || "");
  const others = money.filter((a) => a.id !== bankId);
  const [fromId, setFromId] = useState(others[0]?.id || "");
  const usada = shared.engine.lineUsed[bankId] || 0;
  const [amount, setAmount] = useState(usada ? String(usada) : "");
  const real = shared.engine.bal[fromId] || 0; // pagar línea SOLO con dinero real

  if (!banks.length) return <Sheet title="Pagar línea" close={close}><Empty icon="🏦" title="No hay línea usada" sub="Cuando pagues una tarjeta o crédito con la línea de un banco, aquí podrás devolver ese dinero." /></Sheet>;
  const n = Number(amount) || 0;
  const valid = amount && n <= real && n <= usada && fromId && fromId !== bankId;
  const save = () => { shared.payLine({ bankId, fromId, amount: n }); close(); };

  return (
    <Sheet title="Pagar línea usada" close={close} footer={<button disabled={!valid} onClick={save} style={primaryBtn(!valid)}>{valid ? "Registrar pago" : "Revisa monto y origen"}</button>}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.sub, letterSpacing: 1 }}>LÍNEA USADA</div>
        <div style={{ fontSize: 38, fontWeight: 800, color: C.orange }}>{CLP(usada)}</div>
        <div style={{ color: C.sub, fontSize: 13 }}>La línea se paga solo con dinero real de otra cuenta.</div>
      </div>
      <Field label="Banco con línea usada">
        <select style={{ ...input, appearance: "none" }} value={bankId} onChange={(e) => { setBankId(e.target.value); setAmount(String(shared.engine.lineUsed[e.target.value] || 0)); }}>
          {banks.map((a) => <option key={a.id} value={a.id}>{a.name} — línea usada {CLP(shared.engine.lineUsed[a.id] || 0)}</option>)}
        </select>
      </Field>
      <Field label="Pagar desde (dinero real)">
        <select style={{ ...input, appearance: "none" }} value={fromId} onChange={(e) => setFromId(e.target.value)}>
          {others.map((a) => <option key={a.id} value={a.id}>{a.name} — disp. {CLP(shared.engine.bal[a.id] || 0)}</option>)}
        </select>
      </Field>
      <Field label="Monto"><input style={input} type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={String(usada)} /></Field>
      {n > real && <div style={{ background: C.redSoft, color: C.red, borderRadius: 12, padding: 12, fontSize: 13 }}>⚠ La línea se paga con dinero real. {shared.acc(fromId)?.name} solo tiene {CLP(real)}.</div>}
      {n > usada && <div style={{ background: C.redSoft, color: C.red, borderRadius: 12, padding: 12, fontSize: 13 }}>⚠ El monto supera la línea usada ({CLP(usada)}).</div>}
    </Sheet>
  );
}
function Pulse({ shared, close }) {
  const money = shared.accounts.filter((a) => a.type !== "tarjeta" && a.type !== "credito");
  const [reals, setReals] = useState({});
  const [step, setStep] = useState(0);
  if (!money.length) return <Sheet title="Pulso Cuadra" close={close}><Empty icon="📊" title="Sin cuentas de dinero" sub="Agrega efectivo o banco para conciliar saldos." /></Sheet>;
  const cur = money[step];
  const esperado = shared.engine.bal[cur.id] || 0;
  const real = reals[cur.id] === undefined ? "" : reals[cur.id];
  const diff = real === "" ? 0 : Number(real) - esperado;

  const next = () => {
    if (diff !== 0) shared.pulseAdjust({ accountId: cur.id, diff });
    if (step < money.length - 1) setStep(step + 1);
    else close();
  };

  return (
    <Sheet title="Pulso Cuadra" close={close} footer={<button onClick={next} style={primaryBtn(false)}>{step < money.length - 1 ? "Siguiente cuenta" : "Finalizar revisión"}</button>}>
      <div style={{ textAlign: "center", color: C.sub, fontSize: 13, marginBottom: 16 }}>Compara lo esperado con lo real. La corrección queda como movimiento trazable — sin ajustes silenciosos.</div>
      <div style={{ background: C.card, borderRadius: 18, padding: 20, border: `1px solid ${C.line}`, marginBottom: 14 }}>
        <div style={{ fontSize: 13, color: C.sub, marginBottom: 4 }}>Cuenta {step + 1}/{money.length}</div>
        <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 16 }}>{cur.name}</div>
        <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1, background: C.blueSoft, borderRadius: 14, padding: 14 }}>
            <div style={{ fontSize: 12, color: C.blue, fontWeight: 700 }}>􀐫 Esperado</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: C.blue }}>{CLP(esperado)}</div>
          </div>
          <div style={{ flex: 1, background: C.tealSoft, borderRadius: 14, padding: 14 }}>
            <div style={{ fontSize: 12, color: C.green, fontWeight: 700 }}>􀁢 Real</div>
            <input type="number" value={real} onChange={(e) => setReals((p) => ({ ...p, [cur.id]: e.target.value }))} placeholder="Anota" style={{ width: "100%", boxSizing: "border-box", background: "transparent", border: "none", color: C.green, fontSize: 22, fontWeight: 800, outline: "none" }} />
          </div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 12, color: C.sub, fontWeight: 700 }}>DIFERENCIA</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: diff === 0 ? C.green : C.orange }}>{diff > 0 ? "+" : ""}{CLP(diff)}</div>
          <div style={{ fontSize: 13, color: C.sub }}>{diff === 0 ? "¡Todo cuadrado!" : diff < 0 ? "Se registrará como gasto" : "Se registrará como ingreso"}</div>
        </div>
      </div>
    </Sheet>
  );
}

// ---- Programados ----
function Scheduled({ shared, close }) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState("ingreso");
  const money = shared.accounts.filter((a) => a.type !== "tarjeta" && a.type !== "credito");
  const [accountId, setAccountId] = useState(money[0]?.id || "");

  const add = () => {
    if (!name.trim() || !amount) return;
    shared.setScheduled((p) => [...p, { id: uid(), name: name.trim(), amount: Number(amount), type, accountId }]);
    setName(""); setAmount(""); shared.notify("Programado agregado");
  };
  const confirm = (s) => {
    shared.addMovement({ kind: s.type, amount: s.amount, accountId: s.accountId, merchant: s.name, month: todayKey(), status: "confirmado" });
    shared.setScheduled((p) => p.filter((x) => x.id !== s.id));
    shared.notify("Confirmado — ahora toca el saldo");
  };

  return (
    <Sheet title="Programados" close={close} footer={<button onClick={add} style={primaryBtn(!name.trim() || !amount)}>Agregar programado</button>}>
      <div style={{ background: C.tealSoft, borderRadius: 14, padding: 14, marginBottom: 16, fontSize: 13, color: C.green }}>􀎡 Vista futura: los programados no tocan tus saldos hasta que los confirmas.</div>
      <Field label="Nombre"><input style={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Sueldo, arriendo" /></Field>
      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, color: C.sub, fontWeight: 700, marginBottom: 6 }}>TIPO</div>
          <div style={{ display: "flex", gap: 6 }}>
            {[["ingreso", "Ingreso"], ["gasto", "Gasto"]].map(([id, l]) => (
              <button key={id} onClick={() => setType(id)} style={{ flex: 1, background: type === id ? C.teal : C.card, border: `1px solid ${type === id ? C.teal : C.line}`, color: type === id ? "#fff" : C.sub, padding: "12px 0", borderRadius: 12, fontWeight: 700, fontSize: 13 }}>{l}</button>
            ))}
          </div>
        </div>
        <div style={{ flex: 1 }}><Field label="Monto"><input style={input} type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" /></Field></div>
      </div>
      <Field label="Cuenta">
        <select style={{ ...input, appearance: "none" }} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          {money.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </Field>

      {shared.scheduled.length > 0 && (
        <>
          <div style={{ fontWeight: 700, margin: "16px 0 10px" }}>Vista futura ({shared.scheduled.length})</div>
          {shared.scheduled.map((s) => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 12, background: C.card, borderRadius: 14, padding: 14, marginBottom: 8, border: `1px solid ${C.line}` }}>
              <span style={{ width: 38, height: 38, borderRadius: 11, background: s.type === "ingreso" ? C.tealSoft : C.redSoft, color: s.type === "ingreso" ? C.green : C.red, display: "grid", placeItems: "center" }}>{s.type === "ingreso" ? "􀄩" : "􀄨"}</span>
              <div style={{ flex: 1 }}><div style={{ fontWeight: 700 }}>{s.name}</div><div style={{ fontSize: 12, color: C.orange }}>Próximo · programado</div></div>
              <button onClick={() => confirm(s)} style={{ background: C.teal, border: "none", color: "#fff", padding: "9px 14px", borderRadius: 12, fontWeight: 700, fontSize: 13 }}>Confirmar</button>
            </div>
          ))}
        </>
      )}
    </Sheet>
  );
}

// ---- Detalle de cuenta ----
function AccountDetail({ shared, accountId, close }) {
  const a = shared.accounts.find((x) => x.id === accountId);
  const [month, setMonth] = useState(todayKey());
  if (!a) return null;
  const isCard = a.type === "tarjeta";
  const isCredit = a.type === "credito";
  const movs = shared.movements.filter((m) => (m.accountId === accountId || m.fromId === accountId || m.toId === accountId || m.cardId === accountId || m.creditId === accountId || m.bankId === accountId));

  const facturar = isCard ? shared.engine.cardUsed[accountId] || 0 : 0;
  const cupoDisp = isCard ? (a.cupo || 0) - facturar : 0;
  const uso = isCard && a.cupo ? Math.round((facturar / a.cupo) * 100) : 0;

  const del = () => {
    if (movs.length) { alert("Esta cuenta tiene movimientos. Elimínalos primero."); return; }
    shared.setAccounts((p) => p.filter((x) => x.id !== accountId));
    shared.setModal(null);
    shared.notify("Cuenta eliminada");
  };

  return (
    <Sheet title={a.name} close={close}>
      {isCard ? (
        <>
          <div style={{ fontSize: 34, fontWeight: 800 }}>{CLP(cupoDisp)}</div>
          <div style={{ fontSize: 12, color: C.sub, fontWeight: 700, marginBottom: 14 }}>CUPO DISPONIBLE</div>
          <div style={{ background: C.card, borderRadius: 16, padding: 16, marginBottom: 14, border: `1px solid ${C.line}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}><span style={{ fontWeight: 700 }}>Uso de cupo</span><span style={{ fontWeight: 700 }}>{uso}%</span></div>
            <div style={{ height: 6, background: C.card2, borderRadius: 3, marginBottom: 12 }}><div style={{ height: 6, width: `${uso}%`, background: C.teal, borderRadius: 3 }} /></div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <div><div style={{ color: C.sub, fontWeight: 700 }}>USADO</div><div>{CLP(facturar)}</div></div>
              <div><div style={{ color: C.sub, fontWeight: 700 }}>POR FACTURAR</div><div>{CLP(facturar)}</div></div>
              <div><div style={{ color: C.sub, fontWeight: 700 }}>CUPO TOTAL</div><div>{CLP(a.cupo || 0)}</div></div>
            </div>
          </div>
          <button onClick={() => { close(); shared.setModal({ type: "payCard" }); }} style={{ ...primaryBtn(false), background: "#f2f5f8", color: "#000", marginBottom: 16 }}>􀍯 Pagar tarjeta</button>
        </>
      ) : isCredit ? (
        <>
          <div style={{ fontSize: 12, color: C.sub, fontWeight: 700 }}>DEUDA PENDIENTE</div>
          <div style={{ fontSize: 34, fontWeight: 800, color: C.orange, marginBottom: 4 }}>{CLP(shared.engine.debt[accountId] || 0)}</div>
          <div style={{ color: C.sub, fontSize: 13, marginBottom: 14 }}>Cuota {CLP(a.cuotaValue || 0)} · Restan {a.cuotasRestantes || 0} cuotas</div>
          <div style={{ background: C.card, borderRadius: 14, padding: 14, marginBottom: 14, border: `1px solid ${C.line}`, display: "flex", justifyContent: "space-between" }}>
            <div><div style={{ fontSize: 11, color: C.sub, fontWeight: 700 }}>PRÓX. VENCIMIENTO</div><div style={{ fontWeight: 700 }}>{a.vencMonth ? keyToLabel(a.vencMonth) : "—"}{a.pagoDia ? ` · día ${a.pagoDia}` : ""}</div></div>
            <div style={{ textAlign: "right" }}><div style={{ fontSize: 11, color: C.sub, fontWeight: 700 }}>CUOTAS RESTANTES</div><div style={{ fontWeight: 700 }}>{a.cuotasRestantes || 0}</div></div>
          </div>
          <button onClick={() => { close(); shared.setModal({ type: "payCredit" }); }} style={{ ...primaryBtn(false), marginBottom: 16 }}>􀈎 Pagar crédito</button>
        </>
      ) : (
        <>
          {(() => {
            const b = shared.engine.bal[accountId] || 0;
            const usada = shared.engine.lineUsed[accountId] || 0;
            const lineaDisp = Math.max(0, (a.line || 0) - usada);
            return (
              <>
                <div style={{ fontSize: 34, fontWeight: 800, color: b < 0 ? C.orange : C.txt }}>{CLP(b)}</div>
                <div style={{ fontSize: 12, color: C.sub, fontWeight: 700, marginBottom: 16 }}>
                  SALDO ACTUAL{a.line ? ` · Línea disp. ${CLP(lineaDisp)}` : ""}{usada > 0 ? ` · usada ${CLP(usada)}` : ""}
                </div>
                {usada > 0 && (
                  <button onClick={() => { close(); shared.setModal({ type: "payLine" }); }} style={{ ...primaryBtn(false), background: C.orangeSoft, border: `1px solid ${C.orange}`, color: C.orange, marginBottom: 16 }}>🏦 Pagar línea usada ({CLP(usada)})</button>
                )}
              </>
            );
          })()}
        </>
      )}

      <div style={{ fontWeight: 700, marginBottom: 10 }}>Movimientos</div>
      {movs.length === 0 ? (
        <div style={{ background: C.card2, borderRadius: 14, padding: 20, textAlign: "center", color: C.sub }}>Sin movimientos en esta cuenta.</div>
      ) : movs.map((m) => <MovRow key={m.id} m={m} acc={shared.acc} />)}

      {movs.length === 0 && (
        <button onClick={del} style={{ width: "100%", marginTop: 16, background: C.orangeSoft, border: `1px solid ${C.orange}`, color: C.orange, padding: 14, borderRadius: 14, fontWeight: 700 }}>🗑 Eliminar cuenta</button>
      )}
    </Sheet>
  );
}
