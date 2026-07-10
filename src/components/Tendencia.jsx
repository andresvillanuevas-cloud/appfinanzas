import { C, CLP, keyToLabel, MESES } from "../lib/theme";
import { addMonths, todayKey, computeMonthStats } from "../engine/engine";
import { Sheet, Empty } from "./ui";

// Tendencia: ingresos vs gastos en los últimos 6 meses + desglose de gastos
// por categoría del mes actual. Sin librerías de gráficos (barras con divs).
export function Tendencia({ shared, close }) {
  const { movements, categories } = shared;

  if (!movements.length) {
    return <Sheet title="Tendencia" close={close}><Empty icon="📈" title="Sin datos todavía" sub="Registra ingresos y gastos para ver tu tendencia por mes." /></Sheet>;
  }

  // últimos 6 meses terminando en el mes actual
  const months = Array.from({ length: 6 }, (_, i) => addMonths(todayKey(), i - 5));
  const data = months.map((m) => ({ m, ...computeMonthStats(movements, m) }));
  const maxVal = Math.max(1, ...data.flatMap((d) => [d.ing, d.gas]));

  // desglose de gastos por categoría del mes actual
  const mesCat = todayKey();
  const gastosMes = movements.filter((m) => m.month === mesCat && (m.kind === "gasto" || m.kind === "cuotaTC") && (m.status === "confirmado" || m.status === "cuadrado"));
  const byCat = {};
  gastosMes.forEach((m) => { const k = m.categoryId || "sin"; byCat[k] = (byCat[k] || 0) + m.amount; });
  const cats = Object.entries(byCat)
    .map(([id, val]) => ({
      id, val,
      name: id === "sin" ? "Sin categoría" : (categories.find((c) => c.id === id)?.name || "—"),
      color: categories.find((c) => c.id === id)?.color || C.faint,
    }))
    .sort((a, b) => b.val - a.val);
  const totalGasto = cats.reduce((s, c) => s + c.val, 0);

  return (
    <Sheet title="Tendencia" close={close}>
      {/* ingresos vs gastos por mes */}
      <div style={{ fontWeight: 800, fontSize: 18 }}>Ingresos vs Gastos</div>
      <div style={{ color: C.sub, fontSize: 13, marginBottom: 16 }}>Últimos 6 meses</div>
      <div style={{ display: "flex", gap: 6, alignItems: "flex-end", marginBottom: 10 }}>
        {data.map((d) => (
          <div key={d.m} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <div style={{ display: "flex", gap: 3, alignItems: "flex-end", height: 130, width: "100%", justifyContent: "center" }}>
              <div title={`Ingresos ${CLP(d.ing)}`} style={{ width: 11, height: `${Math.round((d.ing / maxVal) * 130)}px`, minHeight: d.ing > 0 ? 3 : 0, background: C.green, borderRadius: 3 }} />
              <div title={`Gastos ${CLP(d.gas)}`} style={{ width: 11, height: `${Math.round((d.gas / maxVal) * 130)}px`, minHeight: d.gas > 0 ? 3 : 0, background: C.red, borderRadius: 3 }} />
            </div>
            <div style={{ fontSize: 10, color: C.sub, textTransform: "capitalize" }}>{MESES[Number(d.m.split("-")[1]) - 1]}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 16, justifyContent: "center", fontSize: 12, marginBottom: 26 }}>
        <span style={{ color: C.green, fontWeight: 700 }}>● Ingresos</span>
        <span style={{ color: C.red, fontWeight: 700 }}>● Gastos</span>
      </div>

      {/* gastos por categoría del mes actual */}
      <div style={{ fontWeight: 800, fontSize: 18 }}>Gastos por categoría</div>
      <div style={{ color: C.sub, fontSize: 13, marginBottom: 16 }}>{keyToLabel(mesCat)} · {CLP(totalGasto)}</div>
      {cats.length === 0 ? (
        <div style={{ color: C.sub, fontSize: 14, textAlign: "center", padding: 20 }}>Sin gastos este mes.</div>
      ) : cats.map((c) => (
        <div key={c.id} style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginBottom: 5 }}>
            <span style={{ fontWeight: 600 }}>{c.name}</span>
            <span style={{ color: C.sub }}>{CLP(c.val)} · {Math.round((c.val / totalGasto) * 100)}%</span>
          </div>
          <div style={{ height: 8, background: C.card2, borderRadius: 4, overflow: "hidden" }}>
            <div style={{ height: 8, width: `${Math.max(3, (c.val / cats[0].val) * 100)}%`, background: c.color, borderRadius: 4 }} />
          </div>
        </div>
      ))}
    </Sheet>
  );
}
