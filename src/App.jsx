import { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";
import { C } from "./lib/theme";
import {
  computeBalances, computeMonthStats, todayKey,
  registerCardPurchase as buildCardPurchase,
  buildCardPayment, buildCreditPayment, buildLinePayment, buildTransfer,
  buildPulseAdjustment, confirmScheduled as buildScheduledMovement,
} from "./engine/engine";
import { useAccounts, useMovements, useCategories, useBudgets, useScheduled } from "./lib/useData";
import { DEFAULT_CATEGORIES } from "./lib/defaults";
import Auth from "./screens/Auth";
import Inicio from "./screens/Inicio";
import Presupuesto from "./screens/Presupuesto";
import Cuentas from "./screens/Cuentas";
import Movimientos from "./screens/Movimientos";
import Mas from "./screens/Mas";
import { LoadingSkeleton } from "./components/ui";
import { NewAccount, AccountDetail } from "./components/AccountModals";
import { QuickAdd, CardPurchase, PayCard, PayCredit, PayLine, Transfer } from "./components/MovementModals";
import { BudgetAssign, Categories } from "./components/BudgetModals";
import { Pulse, Scheduled } from "./components/PulseScheduled";
import { Tendencia } from "./components/Tendencia";

const TABS = [
  { id: "inicio", label: "Inicio", icon: "🏠" },
  { id: "presupuesto", label: "Presupuesto", icon: "📊" },
  { id: "movimientos", label: "Movimientos", icon: "⇄" },
  { id: "cuentas", label: "Cuentas", icon: "🏦" },
  { id: "mas", label: "Más", icon: "⋯" },
];

function Modal({ shared, modal, close }) {
  const t = modal.type;
  if (t === "newAccount") return <NewAccount shared={shared} close={close} />;
  if (t === "accountDetail") return <AccountDetail shared={shared} accountId={modal.accountId} close={close} />;
  if (t === "quick") return <QuickAdd shared={shared} close={close} />;
  if (t === "cardPurchase") return <CardPurchase shared={shared} close={close} />;
  if (t === "payCard") return <PayCard shared={shared} close={close} />;
  if (t === "payCredit") return <PayCredit shared={shared} close={close} />;
  if (t === "payLine") return <PayLine shared={shared} close={close} />;
  if (t === "transfer") return <Transfer shared={shared} close={close} />;
  if (t === "categories") return <Categories shared={shared} close={close} />;
  if (t === "budgetAssign") return <BudgetAssign shared={shared} categoryId={modal.categoryId} close={close} />;
  if (t === "pulse") return <Pulse shared={shared} close={close} />;
  if (t === "scheduled") return <Scheduled shared={shared} close={close} />;
  if (t === "tendencia") return <Tendencia shared={shared} close={close} />;
  return null;
}

const FAB_ACTIONS = [
  ["Registro rápido", "📝", "quick"],
  ["Transferencia", "⇄", "transfer"],
  ["Gasto TC", "💳", "cardPurchase"],
  ["Pago TC", "💳", "payCard"],
  ["Pago crédito", "📄", "payCredit"],
  ["Pago línea", "🏦", "payLine"],
];

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = cargando, null = sin sesión
  const [theme, setThemeState] = useState(() => localStorage.getItem("micuadra_theme") || "dark");

  // aplica el tema al <html> (las variables CSS viven en index.css)
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("micuadra_theme", theme);
  }, [theme]);
  const setTheme = (t) => setThemeState(t);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (session === undefined) return <div style={{ minHeight: "100svh", background: C.bg }} />;
  if (!session) return <Auth />;
  return <Main session={session} theme={theme} setTheme={setTheme} />;
}

function Main({ session, theme, setTheme }) {
  const userId = session.user.id;
  const [tab, setTab] = useState("inicio");
  const [viewMonth, setViewMonth] = useState(todayKey());
  const [modal, setModal] = useState(null);
  const [fabOpen, setFabOpen] = useState(false);
  const [toast, setToast] = useState(null);

  const notify = (m) => { setToast(m); setTimeout(() => setToast(null), 2200); };

  const { accounts, addAccount, deleteAccount, loading: loadingAcc } = useAccounts(userId, notify);
  const { movements, addMovements, deleteMovement, deleteMovements, loading: loadingMov } = useMovements(userId, notify);
  const { categories, addCategory, deleteCategory, loading: loadingCat } = useCategories(userId, notify);
  const { budgets, setBudget } = useBudgets(userId, notify);
  const { scheduled, addScheduled, deleteScheduled } = useScheduled(userId, notify);

  // Siembra categorías comunes la PRIMERA vez que la cuenta no tiene ninguna.
  // Flag por usuario para no volver a sembrar aunque el usuario las borre luego.
  useEffect(() => {
    if (loadingCat) return;
    const flag = `micuadra_seeded_categorias_${userId}`;
    if (localStorage.getItem(flag)) return;
    localStorage.setItem(flag, "1");
    if (categories.length === 0) {
      addCategory(DEFAULT_CATEGORIES).then((res) => {
        if (!res) localStorage.removeItem(flag); // si falló, reintenta en la próxima carga
      });
    }
  }, [loadingCat, userId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Agregar categorías sugeridas a mano (por si las borraron todas)
  const seedCategories = () => addCategory(DEFAULT_CATEGORIES);

  // motor contable puro (src/engine/engine.js)
  const engine = useMemo(() => computeBalances(accounts, movements), [accounts, movements]);
  const monthStats = useMemo(() => computeMonthStats(movements, viewMonth), [movements, viewMonth]);

  const acc = (id) => accounts.find((a) => a.id === id);
  const cat = (id) => categories.find((c) => c.id === id);

  // ---------- acciones de negocio (motor puro → persistencia) ----------
  const addMovement = (m) => addMovements(m);
  const registerCardPurchase = (args) => {
    const list = buildCardPurchase(args);
    addMovements(list);
    const n = args.cuotas - ((args.startIndex || 1) - 1);
    notify(args.startIndex > 1 ? `Deuda en curso cargada (${n} cuotas por venir)` : `Compra en ${args.cuotas} ${args.cuotas === 1 ? "cuota" : "cuotas"} registrada`);
  };
  const payCard = (args) => { addMovements(buildCardPayment(args)); notify("Pago de tarjeta registrado"); };
  const payCredit = (args) => { addMovements(buildCreditPayment(args)); notify("Pago de crédito registrado"); };
  const payLine = (args) => { addMovements(buildLinePayment(args)); notify("Pago de línea registrado"); };
  const transfer = (args) => { addMovements(buildTransfer(args)); notify("Transferencia registrada"); };

  // Pulso: la diferencia se registra como movimiento trazable (cuadrado).
  // Sin categoría: un descuadre de caja no debe distorsionar el presupuesto
  // de ninguna categoría real.
  const pulseAdjust = ({ accountId, diff }) => {
    const mov = buildPulseAdjustment({ accountId, diff, categoryId: null, month: todayKey() });
    if (mov) { addMovements(mov); notify("Diferencia registrada (trazable)"); }
  };
  // Programado: al confirmar se crea el movimiento. Si es único se quita de la
  // lista; si es recurrente (mensual/semanal) queda para confirmarlo de nuevo.
  const confirmScheduled = (s) => {
    addMovements(buildScheduledMovement(s, todayKey()));
    if (s.frequency === "unico") {
      deleteScheduled(s.id);
      notify("Confirmado — ahora toca el saldo");
    } else {
      notify("Confirmado — se repite, sigue en la lista");
    }
  };
  // Borrar un movimiento. Si es una cuota de una compra TC, borra la compra
  // completa (todas sus cuotas) para no dejar una compra a medias.
  const removeMovement = async (m) => {
    if (m.kind === "cuotaTC" && m.purchaseGroup) {
      const ids = movements.filter((x) => x.purchaseGroup === m.purchaseGroup).map((x) => x.id);
      const ok = await deleteMovements(ids);
      if (ok) notify(`Compra eliminada (${ids.length} cuota${ids.length > 1 ? "s" : ""})`);
    } else {
      const ok = await deleteMovement(m.id);
      if (ok) notify("Movimiento eliminado");
    }
  };

  const shared = {
    session, accounts, categories, movements, budgets, scheduled, viewMonth, setViewMonth,
    engine, monthStats, acc, cat, C,
    addAccount, deleteAccount, addMovements, addMovement, deleteMovement, addCategory, deleteCategory,
    setBudget, addScheduled, deleteScheduled, seedCategories,
    registerCardPurchase, payCard, payCredit, payLine, transfer, pulseAdjust, confirmScheduled, removeMovement,
    setModal, notify, theme, setTheme,
  };

  const loading = loadingAcc || loadingMov;

  return (
    <div style={{ minHeight: "100svh", background: C.frame, display: "flex", justifyContent: "center", fontFamily: "-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',Roboto,sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 430, background: C.bg, color: C.txt, minHeight: "100svh", position: "relative", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div style={{ flex: 1, overflowY: "auto", paddingBottom: 120, paddingTop: 10 }}>
          {loading ? (
            <LoadingSkeleton />
          ) : (
            <>
              {tab === "inicio" && <Inicio {...shared} />}
              {tab === "presupuesto" && <Presupuesto {...shared} />}
              {tab === "movimientos" && <Movimientos {...shared} />}
              {tab === "cuentas" && <Cuentas {...shared} />}
              {tab === "mas" && <Mas {...shared} />}
            </>
          )}
        </div>

        {/* FAB radial */}
        {fabOpen && (
          <div onClick={() => setFabOpen(false)} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.55)", backdropFilter: "blur(2px)", zIndex: 40 }}>
            <div style={{ position: "absolute", right: 20, bottom: 170, display: "flex", flexDirection: "column", gap: 12, alignItems: "flex-end" }}>
              {FAB_ACTIONS.map(([label, ic, type]) => (
                <button key={label} onClick={(e) => { e.stopPropagation(); setFabOpen(false); setModal({ type }); }}
                  style={{ display: "flex", alignItems: "center", gap: 10, background: C.card2, border: "none", color: C.txt, padding: "13px 18px", borderRadius: 26, fontSize: 16, fontWeight: 700, boxShadow: "0 6px 20px rgba(0,0,0,.5)", cursor: "pointer" }}>
                  {label}
                  <span style={{ width: 34, height: 34, borderRadius: 12, background: C.teal, display: "grid", placeItems: "center", fontSize: 15 }}>{ic}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* tab bar + botón FAB */}
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, zIndex: 45 }}>
          <button onClick={() => setFabOpen((v) => !v)} style={{ position: "absolute", right: 20, bottom: 78, width: 62, height: 62, borderRadius: 31, border: "none", background: `linear-gradient(140deg,${C.teal},${C.blue})`, color: "#fff", fontSize: 30, boxShadow: "0 8px 24px rgba(0,0,0,.5)", transform: fabOpen ? "rotate(45deg)" : "none", transition: ".2s", zIndex: 50, cursor: "pointer" }}>+</button>
          <div style={{ background: C.bar, backdropFilter: "blur(20px)", borderTop: `1px solid ${C.line}`, display: "flex", padding: "10px 6px 18px" }}>
            {TABS.map(({ id, label, icon }) => (
              <button key={id} onClick={() => setTab(id)} style={{ flex: 1, background: "none", border: "none", color: tab === id ? C.teal : C.sub, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                <span style={{ fontSize: 20 }}>{icon}</span>
                {label}
              </button>
            ))}
          </div>
        </div>

        {toast && (
          <div style={{ position: "absolute", bottom: 150, left: "50%", transform: "translateX(-50%)", background: C.card2, border: `1px solid ${C.line}`, color: C.txt, padding: "12px 20px", borderRadius: 14, fontSize: 14, fontWeight: 600, zIndex: 60, boxShadow: "0 8px 24px rgba(0,0,0,.5)", whiteSpace: "nowrap" }}>{toast}</div>
        )}

        {modal && <Modal shared={shared} modal={modal} close={() => setModal(null)} />}
      </div>
    </div>
  );
}
