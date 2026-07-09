import { useEffect, useMemo, useState } from "react";
import { supabase } from "./lib/supabase";
import { C } from "./lib/theme";
import { computeBalances, computeMonthStats, todayKey } from "./engine/engine";
import { useAccounts, useMovements, useCategories } from "./lib/useData";
import Auth from "./screens/Auth";
import Cuentas from "./screens/Cuentas";
import Movimientos from "./screens/Movimientos";
import Mas from "./screens/Mas";
import { NewAccount, AccountDetail } from "./components/AccountModals";

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
  return null;
}

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = cargando, null = sin sesión

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (session === undefined) return <div style={{ minHeight: "100svh", background: C.bg }} />;
  if (!session) return <Auth />;
  return <Main session={session} />;
}

function Main({ session }) {
  const userId = session.user.id;
  const [tab, setTab] = useState("inicio");
  const [viewMonth, setViewMonth] = useState(todayKey());
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState(null);

  const notify = (m) => { setToast(m); setTimeout(() => setToast(null), 2200); };

  const { accounts, addAccount, deleteAccount, loading: loadingAcc } = useAccounts(userId, notify);
  const { movements, addMovements, deleteMovement, loading: loadingMov } = useMovements(userId, notify);
  const { categories, addCategory, deleteCategory } = useCategories(userId, notify);

  // motor contable puro (src/engine/engine.js)
  const engine = useMemo(() => computeBalances(accounts, movements), [accounts, movements]);
  const monthStats = useMemo(() => computeMonthStats(movements, viewMonth), [movements, viewMonth]);

  const acc = (id) => accounts.find((a) => a.id === id);
  const cat = (id) => categories.find((c) => c.id === id);

  const shared = {
    session, accounts, categories, movements, viewMonth, setViewMonth,
    engine, monthStats, acc, cat, C,
    addAccount, deleteAccount, addMovements, deleteMovement, addCategory, deleteCategory,
    setModal, notify,
  };

  const loading = loadingAcc || loadingMov;

  return (
    <div style={{ minHeight: "100svh", background: "#000", display: "flex", justifyContent: "center", fontFamily: "-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',Roboto,sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 430, background: C.bg, color: C.txt, minHeight: "100svh", position: "relative", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div style={{ flex: 1, overflowY: "auto", paddingBottom: 120, paddingTop: 10 }}>
          {loading ? (
            <div style={{ textAlign: "center", color: C.sub, paddingTop: 80 }}>Cargando tus datos…</div>
          ) : (
            <>
              {tab === "inicio" && <div style={{ padding: 20, color: C.sub }}>Pantalla "Inicio" pendiente (Fase 4).</div>}
              {tab === "presupuesto" && <div style={{ padding: 20, color: C.sub }}>Pantalla "Presupuesto" pendiente (Fase 4).</div>}
              {tab === "movimientos" && <Movimientos {...shared} />}
              {tab === "cuentas" && <Cuentas {...shared} />}
              {tab === "mas" && <Mas {...shared} />}
            </>
          )}
        </div>

        {/* tab bar */}
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, background: "rgba(10,14,20,.92)", backdropFilter: "blur(20px)", borderTop: `1px solid ${C.line}`, display: "flex", padding: "10px 6px 18px" }}>
          {TABS.map(({ id, label, icon }) => (
            <button key={id} onClick={() => setTab(id)} style={{ flex: 1, background: "none", border: "none", color: tab === id ? C.teal : C.sub, display: "flex", flexDirection: "column", alignItems: "center", gap: 3, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
              <span style={{ fontSize: 20 }}>{icon}</span>
              {label}
            </button>
          ))}
        </div>

        {toast && (
          <div style={{ position: "absolute", bottom: 150, left: "50%", transform: "translateX(-50%)", background: C.card2, border: `1px solid ${C.line}`, color: C.txt, padding: "12px 20px", borderRadius: 14, fontSize: 14, fontWeight: 600, zIndex: 60, boxShadow: "0 8px 24px rgba(0,0,0,.5)", whiteSpace: "nowrap" }}>{toast}</div>
        )}

        {modal && <Modal shared={shared} modal={modal} close={() => setModal(null)} />}
      </div>
    </div>
  );
}
