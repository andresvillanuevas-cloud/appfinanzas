import { C, CLP, keyToLabel, PRIORIDADES } from "../lib/theme";
import { Empty, MonthNav } from "../components/ui";

export default function Presupuesto({ categories, budgets, viewMonth, setViewMonth, movements, monthStats, setModal }) {
  const monthBudget = budgets[viewMonth] || {};
  const asignado = Object.values(monthBudget).reduce((s, v) => s + v, 0);
  const gastado = movements
    .filter((m) => m.month === viewMonth && (m.kind === "gasto" || m.kind === "cuotaTC") && (m.status === "confirmado" || m.status === "cuadrado"))
    .reduce((s, m) => s + m.amount, 0);
  const ingresos = monthStats.ing;
  const porAsignar = ingresos - asignado;
  const grupos = PRIORIDADES.map((p) => ({ ...p, cats: categories.filter((c) => c.type === "gasto" && c.prioridad === p.id) }));

  return (
    <div style={{ padding: "6px 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <h1 style={{ fontSize: 17, margin: 0 }}>Presupuesto</h1>
        <MonthNav value={viewMonth} onChange={setViewMonth} />
      </div>

      <div style={{ borderRadius: 24, padding: 20, color: "#fff", background: `linear-gradient(150deg,${C.tealDim},${C.blue})`, marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, opacity: 0.85, marginBottom: 6 }}>📊 PLAN MENSUAL</div>
        <div style={{ fontSize: 14, opacity: 0.85 }}>Por asignar (según ingresos del mes)</div>
        <div style={{ fontSize: 40, fontWeight: 800, marginBottom: 14, color: porAsignar < 0 ? "#ffd7dc" : "#fff" }}>{CLP(porAsignar)}</div>
        <div style={{ display: "flex", gap: 8 }}>
          {[["Ingresos", ingresos], ["Asignado", asignado], ["Gastado", gastado]].map(([l, v]) => (
            <div key={l} style={{ flex: 1, background: "rgba(255,255,255,.1)", borderRadius: 12, padding: "10px 12px" }}>
              <div style={{ fontSize: 12, opacity: 0.8 }}>{l}</div><div style={{ fontWeight: 700 }}>{CLP(v)}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>Categorías</h2>
        <button onClick={() => setModal({ type: "categories" })} style={{ background: C.tealSoft, border: `1px solid ${C.tealDim}`, color: C.green, padding: "8px 16px", borderRadius: 20, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>+ Nueva</button>
      </div>

      {categories.filter((c) => c.type === "gasto").length === 0 ? (
        <Empty icon="🏷️" title="Sin categorías todavía" sub="Crea categorías para ordenar tus gastos y asignar presupuesto." cta="Crear categoría" onCta={() => setModal({ type: "categories" })} />
      ) : (
        grupos.map((g) => g.cats.length ? (
          <div key={g.id} style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <span style={{ color: g.color, fontWeight: 700 }}>● {g.label}</span>
              <span style={{ marginLeft: "auto", fontSize: 13, color: C.sub }}>{g.cats.length}</span>
            </div>
            {g.cats.map((c) => {
              const asig = monthBudget[c.id] || 0;
              const gas = movements
                .filter((m) => m.month === viewMonth && m.categoryId === c.id && (m.kind === "gasto" || m.kind === "cuotaTC") && (m.status === "confirmado" || m.status === "cuadrado"))
                .reduce((s, m) => s + m.amount, 0);
              const pct = asig ? Math.min(100, Math.round((gas / asig) * 100)) : 0;
              return (
                <div key={c.id} style={{ background: C.card, borderRadius: 14, padding: 14, marginBottom: 8, border: `1px solid ${C.line}` }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ width: 38, height: 38, borderRadius: 11, background: `${c.color}22`, display: "grid", placeItems: "center", fontSize: 17 }}>{c.icon || "🏷️"}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700 }}>{c.name}</div>
                      <div style={{ fontSize: 12, color: asig ? (gas > asig ? C.red : C.sub) : C.sub }}>{asig ? `${CLP(gas)} de ${CLP(asig)}` : "Sin presupuesto este mes"}</div>
                    </div>
                    <button onClick={() => setModal({ type: "budgetAssign", categoryId: c.id })} style={{ background: "none", border: "none", color: C.teal, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>{asig ? "Editar" : "Asignar"}</button>
                  </div>
                  {asig ? (
                    <div style={{ height: 6, background: C.card2, borderRadius: 3, marginTop: 10 }}>
                      <div style={{ height: 6, width: `${pct}%`, background: gas > asig ? C.red : c.color, borderRadius: 3 }} />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null)
      )}
    </div>
  );
}
