import { useState } from "react";
import { C } from "../lib/theme";
import { todayKey } from "../engine/engine";
import { Empty, MovRow } from "../components/ui";

export default function Movimientos({ movements, acc, cat, viewMonth }) {
  const [q, setQ] = useState("");
  const [range, setRange] = useState("mes");
  const hoy = todayKey();
  const list = movements.filter((m) => {
    if (range === "mes" && m.month !== viewMonth) return false;
    // "Futuros": meses posteriores al actual (el prototipo dejó este filtro sin efecto; aquí sí filtra)
    if (range === "futuros" && !(m.month > hoy)) return false;
    if (q) {
      const t = `${m.merchant || ""} ${m.note || ""} ${cat(m.categoryId)?.name || ""} ${acc(m.accountId || m.fromId)?.name || ""}`.toLowerCase();
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
          <button key={id} onClick={() => setRange(id)} style={{ flex: 1, border: "none", borderRadius: 11, padding: "9px 0", fontWeight: 700, fontSize: 14, background: range === id ? C.card2 : "transparent", color: range === id ? C.txt : C.sub, cursor: "pointer" }}>{l}</button>
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
