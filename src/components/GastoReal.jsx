import { useState } from "react";
import { C, CLP } from "../lib/theme";
import { todayKey, realExpenseByCategory } from "../engine/engine";
import { Sheet, MonthNav, Empty } from "./ui";

// Panel de SOLO LECTURA: gasto real por categoría de un mes. Una compra TC
// cuenta completa en su mes de compra (no distribuida en cuotas). Sin acciones:
// no edita, no borra, no confirma. Vista derivada, no toca ningún cálculo.
export function GastoReal({ shared, close }) {
  const [month, setMonth] = useState(todayKey());
  const [openCat, setOpenCat] = useState(null); // categoryId en drill-down (o "sin")

  const cats = realExpenseByCategory(shared.movements, month);
  const total = cats.reduce((s, c) => s + c.total, 0);
  const catName = (id) => (id ? shared.cat(id)?.name || "—" : "Sin categoría");
  const catColor = (id) => (id ? shared.cat(id)?.color || C.faint : C.faint);
  const catIcon = (id) => (id ? shared.cat(id)?.icon || "🏷️" : "•");

  // ----- drill-down: items de una categoría -----
  if (openCat !== null) {
    const sel = cats.find((c) => (c.categoryId || "sin") === openCat);
    const items = sel ? [...sel.items].sort((a, b) => (b.ts || 0) - (a.ts || 0)) : [];
    return (
      <Sheet title="Gasto real" close={close}>
        <button onClick={() => setOpenCat(null)} style={{ background: "none", border: "none", color: C.teal, fontSize: 15, fontWeight: 600, cursor: "pointer", padding: 0, marginBottom: 12 }}>‹ Volver</button>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <span style={{ width: 46, height: 46, borderRadius: 12, background: `${catColor(sel?.categoryId)}22`, display: "grid", placeItems: "center", fontSize: 20 }}>{catIcon(sel?.categoryId)}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 18 }}>{catName(sel?.categoryId)}</div>
            <div style={{ color: C.sub, fontSize: 13 }}>{items.length} movimiento{items.length !== 1 ? "s" : ""}</div>
          </div>
          <div style={{ fontWeight: 800, fontSize: 18, color: C.red }}>{CLP(sel?.total || 0)}</div>
        </div>
        {items.map((it) => (
          <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 12, background: C.card, borderRadius: 14, padding: 14, marginBottom: 8, border: `1px solid ${C.line}` }}>
            <span style={{ width: 38, height: 38, borderRadius: 11, background: C.redSoft, color: C.red, display: "grid", placeItems: "center", fontSize: 15 }}>{it.type === "compraTC" ? "💳" : "↑"}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{it.merchant || "Gasto"}</div>
              <div style={{ color: C.sub, fontSize: 12 }}>
                {it.type === "compraTC" ? `Compra TC · ${it.cuotasTotal || 1} cuota${(it.cuotasTotal || 1) > 1 ? "s" : ""}` : "Gasto"}
                {it.ts ? ` · ${new Date(it.ts).toLocaleDateString("es-CL")}` : ""}
              </div>
            </div>
            <div style={{ fontWeight: 800, color: C.red }}>-{CLP(it.amount)}</div>
          </div>
        ))}
      </Sheet>
    );
  }

  // ----- vista principal: categorías del mes -----
  return (
    <Sheet title="Gasto real" close={close}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ color: C.sub, fontSize: 13, maxWidth: 180 }}>Lo que realmente gastaste cada mes. Las compras en cuotas cuentan completas en el mes de compra.</div>
        <MonthNav value={month} onChange={(m) => { setMonth(m); setOpenCat(null); }} />
      </div>

      <div style={{ background: `linear-gradient(150deg,${C.tealDim},${C.blue})`, color: "#fff", borderRadius: 18, padding: 18, marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 700, opacity: 0.85, letterSpacing: 1 }}>TOTAL GASTADO</div>
        <div style={{ fontSize: 34, fontWeight: 800 }}>{CLP(total)}</div>
      </div>

      {cats.length === 0 ? (
        <Empty icon="📊" title="Sin gastos este mes" sub="No registraste gastos ni compras con tarjeta en este período." />
      ) : (
        cats.map((c) => {
          const id = c.categoryId || "sin";
          const pct = total > 0 ? Math.round((c.total / total) * 100) : 0;
          return (
            <div key={id} onClick={() => setOpenCat(id)} style={{ background: C.card, borderRadius: 14, padding: 14, marginBottom: 8, border: `1px solid ${C.line}`, cursor: "pointer" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ width: 38, height: 38, borderRadius: 11, background: `${catColor(c.categoryId)}22`, display: "grid", placeItems: "center", fontSize: 17 }}>{catIcon(c.categoryId)}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700 }}>{catName(c.categoryId)}</div>
                  <div style={{ color: C.sub, fontSize: 12 }}>{c.items.length} movimiento{c.items.length !== 1 ? "s" : ""} · {pct}%</div>
                </div>
                <div style={{ fontWeight: 800, color: C.red }}>{CLP(c.total)}</div>
                <span style={{ color: C.faint, marginLeft: 4 }}>›</span>
              </div>
              <div style={{ height: 6, background: C.card2, borderRadius: 3, marginTop: 10, overflow: "hidden" }}>
                <div style={{ height: 6, width: `${Math.max(3, (c.total / cats[0].total) * 100)}%`, background: catColor(c.categoryId), borderRadius: 3 }} />
              </div>
            </div>
          );
        })
      )}
    </Sheet>
  );
}
