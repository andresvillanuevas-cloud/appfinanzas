import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";
import { C } from "./lib/theme";
import Auth from "./screens/Auth";
import Mas from "./screens/Mas";

const TABS = [
  { id: "inicio", label: "Inicio", icon: "🏠" },
  { id: "presupuesto", label: "Presupuesto", icon: "📊" },
  { id: "movimientos", label: "Movimientos", icon: "↔️" },
  { id: "cuentas", label: "Cuentas", icon: "🏦" },
  { id: "mas", label: "Más", icon: "⋯" },
];

export default function App() {
  const [session, setSession] = useState(undefined); // undefined = cargando, null = sin sesión
  const [tab, setTab] = useState("inicio");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (session === undefined) {
    return <div style={{ minHeight: "100svh", background: C.bg }} />;
  }

  if (!session) return <Auth />;

  return (
    <div
      style={{
        minHeight: "100svh",
        background: C.bg,
        color: C.txt,
        display: "flex",
        flexDirection: "column",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <div style={{ flex: 1 }}>
        {tab === "mas" ? (
          <Mas session={session} />
        ) : (
          <div style={{ padding: 20, color: C.sub }}>Pantalla "{tab}" pendiente (próximas fases).</div>
        )}
      </div>

      <div
        style={{
          display: "flex",
          borderTop: `1px solid ${C.line}`,
          background: C.card,
        }}
      >
        {TABS.map(({ id, label, icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            style={{
              flex: 1,
              background: "none",
              border: "none",
              color: tab === id ? C.teal : C.sub,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 3,
              padding: "10px 0",
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <span style={{ fontSize: 18 }}>{icon}</span>
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
