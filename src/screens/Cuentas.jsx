import { C, CLP, keyToLabel, keyToLabelLargo, ACCOUNT_TYPES } from "../lib/theme";
import { projectedCardPaymentsAll } from "../engine/engine";
import { Empty, Eyebrow } from "../components/ui";

export default function Cuentas({ accounts, engine, movements, setModal }) {
  const groups = [
    { label: "Dinero y ahorro", types: ["efectivo", "banco", "ahorro", "inversion"] },
    { label: "Tarjetas", types: ["tarjeta"] },
    { label: "Créditos", types: ["credito"] },
  ];
  // proyección consolidada de cuotas TC de todas las tarjetas (solo lectura)
  const proyeccion = projectedCardPaymentsAll(movements || []);

  // "Por confirmar": efecto neto de los movimientos PENDIENTES sobre el patrimonio
  // (ingreso pendiente suma, gasto pendiente resta). No toca el saldo real: es
  // lo que cambiaría el patrimonio cuando confirmes esos pendientes.
  const porConfirmar = (movements || []).reduce((s, m) => {
    if (m.status !== "pendiente") return s;
    if (m.kind === "ingreso") return s + m.amount;
    if (m.kind === "gasto") return s - m.amount;
    return s;
  }, 0);
  const esperado = engine.patrimonio + porConfirmar;
  return (
    <div style={{ padding: "6px 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ fontSize: 17, margin: 0, flex: 1, textAlign: "center", paddingLeft: 40 }}>Cuentas</h1>
        <button onClick={() => setModal({ type: "newAccount" })} style={{ width: 40, height: 40, borderRadius: 20, background: C.tealSoft, border: `1px solid ${C.tealDim}`, color: C.green, fontSize: 22, cursor: "pointer" }}>+</button>
      </div>

      <div style={{ borderRadius: 24, padding: 20, color: "#fff", background: `linear-gradient(150deg,${C.tealDim},${C.blue})`, marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
          <span style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(255,255,255,.15)", display: "grid", placeItems: "center" }}>🗓</span>
          <span style={{ background: "rgba(255,255,255,.15)", padding: "4px 12px", borderRadius: 12, fontSize: 13, fontWeight: 700 }}>{accounts.length} cuentas</span>
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, opacity: 0.8 }}>TOTAL CONFIRMADO</div>
        <div style={{ fontSize: 40, fontWeight: 800, margin: "2px 0 14px" }}>{CLP(engine.patrimonio)}</div>
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1, background: "rgba(255,255,255,.1)", borderRadius: 14, padding: "10px 14px" }}>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Esperado</div><div style={{ fontWeight: 700 }}>{CLP(esperado)}</div>
          </div>
          <div style={{ flex: 1, background: "rgba(255,255,255,.1)", borderRadius: 14, padding: "10px 14px" }}>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Por confirmar</div><div style={{ fontWeight: 700 }}>{porConfirmar >= 0 ? "+" : ""}{CLP(porConfirmar)}</div>
          </div>
        </div>
      </div>

      {proyeccion.length > 0 && (
        <div style={{ background: C.card, borderRadius: 20, padding: 16, border: `1px solid ${C.line}`, marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: 18 }}>🗓</span>
            <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Proyección de cuotas</h2>
          </div>
          <div style={{ color: C.sub, fontSize: 12, marginBottom: 12 }}>Lo que viene a facturarse entre todas tus tarjetas.</div>
          {proyeccion.map(({ month, total }, i) => (
            <div key={month} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 2px", borderBottom: i < proyeccion.length - 1 ? `1px solid ${C.line}` : "none" }}>
              <span style={{ fontWeight: 600 }}>{keyToLabelLargo(month)}</span>
              <span style={{ fontWeight: 800, color: C.orange }}>{CLP(total)}</span>
            </div>
          ))}
        </div>
      )}

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
                const right = isCard ? (engine.cardUsed[a.id] != null ? (a.cupo || 0) - engine.cardUsed[a.id] : a.cupo) : isCredit ? engine.debt[a.id] : engine.bal[a.id];
                return (
                  <div key={a.id} onClick={() => setModal({ type: "accountDetail", accountId: a.id })} style={{ display: "flex", alignItems: "center", gap: 12, background: C.card, borderRadius: 16, padding: 16, marginBottom: 8, border: `1px solid ${C.line}`, cursor: "pointer" }}>
                    <span style={{ width: 44, height: 44, borderRadius: 12, background: `${a.color}22`, display: "grid", placeItems: "center", fontSize: 20 }}>{ACCOUNT_TYPES.find((t) => t.id === a.type)?.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 17 }}>{a.name}</div>
                      <div style={{ color: C.sub, fontSize: 13 }}>
                        {isCard ? `Tarjeta de crédito · cupo ${CLP(a.cupo || 0)}` : isCredit ? `Crédito · ${a.cuotasRestantes || 0} cuotas${a.vencMonth ? ` · vence ${keyToLabel(a.vencMonth)}` : ""}` : a.line ? `Línea disp. ${CLP(Math.max(0, (a.line || 0) - (engine.lineUsed[a.id] || 0)))}` : ACCOUNT_TYPES.find((t) => t.id === a.type)?.label}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 11, color: C.sub, fontWeight: 700 }}>{isCard ? "CUPO" : isCredit ? "PENDIENTE" : "SALDO"}</div>
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
