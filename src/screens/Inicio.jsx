import { useState } from "react";
import { C, CLP, keyToLabel, ACCOUNT_TYPES } from "../lib/theme";
import { Card, Empty, SectionHead, MovRow } from "../components/ui";

export default function Inicio({ engine, monthStats, accounts, movements, acc, setModal }) {
  const [scope, setScope] = useState("mes");
  const disponible = scope === "mes" ? monthStats.ing - monthStats.gas : engine.totalDinero;
  const money = accounts.filter((a) => a.type !== "tarjeta" && a.type !== "credito");
  const deudas = accounts.filter((a) => a.type === "tarjeta" || a.type === "credito");
  const recent = movements.filter((m) => ["gasto", "ingreso", "transferencia", "cuotaTC"].includes(m.kind)).slice(0, 3);

  return (
    <div style={{ padding: "6px 16px" }}>
      <h1 style={{ textAlign: "center", fontSize: 17, margin: "4px 0 16px" }}>Inicio</h1>

      {/* hero */}
      <div style={{ borderRadius: 24, padding: 20, color: "#fff", background: `linear-gradient(150deg,${C.tealDim},${C.blue})`, marginBottom: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, opacity: 0.85 }}>🗓 DISPONIBLE DEL MES</span>
          <span style={{ fontSize: 12, fontWeight: 700, opacity: 0.8 }}>CLP</span>
        </div>
        <div style={{ display: "flex", background: "rgba(255,255,255,.12)", borderRadius: 22, padding: 4, marginBottom: 16 }}>
          {["mes", "total"].map((s) => (
            <button key={s} onClick={() => setScope(s)} style={{ flex: 1, border: "none", borderRadius: 18, padding: "9px 0", fontWeight: 700, fontSize: 14, background: scope === s ? "#fff" : "transparent", color: scope === s ? C.tealDim : "#fff", cursor: "pointer" }}>{s === "mes" ? "Mes" : "Total"}</button>
          ))}
        </div>
        <div style={{ opacity: 0.85, fontSize: 14, marginBottom: 2 }}>Disponible</div>
        <div style={{ fontSize: 42, fontWeight: 800, marginBottom: 16 }}>{CLP(disponible)}</div>
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1, background: "rgba(255,255,255,.1)", borderRadius: 16, padding: "12px 14px" }}>
            <div style={{ fontSize: 12, opacity: 0.8 }}>💰 Esperado</div>
            <div style={{ fontWeight: 700, fontSize: 18 }}>{CLP(engine.totalDinero)}</div>
          </div>
          <div style={{ flex: 1, background: "rgba(255,255,255,.1)", borderRadius: 16, padding: "12px 14px" }}>
            <div style={{ fontSize: 12, opacity: 0.8 }}>📊 Patrimonio</div>
            <div style={{ fontWeight: 700, fontSize: 18 }}>{CLP(engine.patrimonio)}</div>
          </div>
        </div>
      </div>

      {/* ingresos / gastos */}
      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        <Card style={{ flex: 1, padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 30, height: 30, borderRadius: 15, background: C.tealSoft, color: C.green, display: "grid", placeItems: "center" }}>↓</span>
            <div><div style={{ fontSize: 11, color: C.sub, fontWeight: 700 }}>INGRESOS MES</div><div style={{ fontWeight: 700 }}>{CLP(monthStats.ing)}</div></div>
          </div>
        </Card>
        <Card style={{ flex: 1, padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 30, height: 30, borderRadius: 15, background: C.redSoft, color: C.red, display: "grid", placeItems: "center" }}>↑</span>
            <div><div style={{ fontSize: 11, color: C.sub, fontWeight: 700 }}>GASTOS MES</div><div style={{ fontWeight: 700 }}>{CLP(monthStats.gas)}</div></div>
          </div>
        </Card>
      </div>

      {/* pulso */}
      <Card onClick={() => setModal({ type: "pulse" })} style={{ marginBottom: 18, display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
        <span style={{ width: 42, height: 42, borderRadius: 14, background: C.tealSoft, color: C.green, display: "grid", placeItems: "center", fontSize: 18 }}>💓</span>
        <div style={{ flex: 1 }}><div style={{ fontWeight: 700 }}>¡A cuadrar!</div><div style={{ color: C.sub, fontSize: 13 }}>Revisa tus saldos reales vs esperados</div></div>
        <span style={{ color: C.faint }}>›</span>
      </Card>

      {/* dinero */}
      <SectionHead label="Dinero" count={money.length} />
      {money.length === 0 ? (
        <Empty icon="💳" title="Crea tu primera cuenta" sub="Agrega efectivo, banco o ahorro para empezar a registrar movimientos." cta="Crear cuenta" onCta={() => setModal({ type: "newAccount" })} />
      ) : (
        <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 6, marginBottom: 18 }}>
          {money.map((a) => (
            <div key={a.id} onClick={() => setModal({ type: "accountDetail", accountId: a.id })} style={{ minWidth: 160, background: C.card, borderRadius: 18, padding: 16, border: `1px solid ${C.line}`, cursor: "pointer" }}>
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
          <span style={{ width: 40, height: 40, borderRadius: 12, background: C.tealSoft, color: C.green, display: "grid", placeItems: "center" }}>✓</span>
          <div><div style={{ fontWeight: 700 }}>Sin deudas activas</div><div style={{ color: C.sub, fontSize: 13 }}>Las tarjetas, créditos y líneas usadas aparecerán aquí.</div></div>
        </Card>
      ) : (
        <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 6, marginBottom: 18 }}>
          {deudas.map((a) => {
            const isCard = a.type === "tarjeta";
            const facturar = isCard ? engine.cardUsed[a.id] || 0 : engine.debt[a.id] || 0;
            return (
              <div key={a.id} onClick={() => setModal({ type: "accountDetail", accountId: a.id })} style={{ minWidth: 180, background: C.card, borderRadius: 18, padding: 16, border: `1px solid ${C.line}`, cursor: "pointer" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                  <span style={{ fontSize: 20 }}>{isCard ? "💳" : "📄"}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: C.blue, background: C.blueSoft, padding: "3px 8px", borderRadius: 8 }}>{isCard ? `Cierra día ${a.cierre || 24}` : a.vencMonth ? `Vence ${keyToLabel(a.vencMonth)}` : "Pendiente"}</span>
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
