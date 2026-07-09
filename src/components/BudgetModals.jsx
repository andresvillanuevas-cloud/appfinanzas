import { useState } from "react";
import { C, CLP, keyToLabel, PRIORIDADES } from "../lib/theme";
import { Sheet, Field, input, primaryBtn } from "./ui";

// ---- Asignar/editar presupuesto de una categoría en un mes ----
export function BudgetAssign({ shared, categoryId, close }) {
  const c = shared.categories.find((x) => x.id === categoryId);
  const current = shared.budgets[shared.viewMonth]?.[categoryId] || 0;
  const [amount, setAmount] = useState(current ? String(current) : "");
  if (!c) return null;
  const save = async () => {
    await shared.setBudget(shared.viewMonth, categoryId, amount);
    shared.notify("Presupuesto asignado");
    close();
  };
  return (
    <Sheet title="Asignar presupuesto" close={close} footer={<button onClick={save} style={primaryBtn(false)}>Guardar</button>}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <span style={{ width: 46, height: 46, borderRadius: 12, background: `${c.color}22`, display: "grid", placeItems: "center", fontSize: 20 }}>{c.icon || "🏷️"}</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: 17 }}>{c.name}</div>
          <div style={{ color: C.sub, fontSize: 13 }}>{keyToLabel(shared.viewMonth)}</div>
        </div>
      </div>
      <Field label="Monto asignado este mes">
        <input style={input} type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" autoFocus />
      </Field>
      <div style={{ color: C.sub, fontSize: 13 }}>Deja en 0 para quitar el presupuesto de esta categoría este mes.</div>
    </Sheet>
  );
}

// ---- Categorías (CRUD) ----
export function Categories({ shared, close }) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState("gasto");
  const [prioridad, setPrioridad] = useState("necesidades");
  const [icon, setIcon] = useState("🏷️");
  const [color, setColor] = useState(C.teal);
  const icons = ["🏷️", "🏠", "🍔", "🚗", "💡", "🛒", "🎬", "💧", "👕", "☕", "💊", "🎁", "📱", "✈️", "💰", "🐾"];
  const palette = [C.teal, C.blue, C.violet, C.green, C.orange, C.red];

  const create = () => {
    if (!name.trim()) return;
    shared.addCategory({ name: name.trim(), type, prioridad: type === "gasto" ? prioridad : "obligaciones", icon, color });
    shared.notify("Categoría creada");
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
              {[["gasto", "↑ Gasto"], ["ingreso", "↓ Ingreso"]].map(([id, l]) => (
                <button key={id} onClick={() => setType(id)} style={{ flex: 1, background: type === id ? C.teal : C.card, border: `1px solid ${type === id ? C.teal : C.line}`, color: type === id ? "#fff" : C.green, padding: "13px 0", borderRadius: 14, fontWeight: 700, cursor: "pointer" }}>{l}</button>
              ))}
            </div>
          </Field>
          {type === "gasto" && (
            <Field label="Prioridad">
              <div style={{ display: "flex", gap: 8 }}>
                {PRIORIDADES.map((p) => (
                  <button key={p.id} onClick={() => setPrioridad(p.id)} style={{ flex: 1, background: prioridad === p.id ? p.color : C.card, border: `1px solid ${prioridad === p.id ? p.color : C.line}`, color: prioridad === p.id ? "#fff" : p.color, padding: "12px 4px", borderRadius: 12, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>{p.label}</button>
                ))}
              </div>
            </Field>
          )}
          <Field label="Ícono">
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {icons.map((i) => (
                <button key={i} onClick={() => setIcon(i)} style={{ width: 46, height: 46, borderRadius: 12, fontSize: 20, background: icon === i ? `${color}33` : C.card, border: `1.5px solid ${icon === i ? color : C.line}`, cursor: "pointer" }}>{i}</button>
              ))}
            </div>
          </Field>
          <Field label="Color">
            <div style={{ display: "flex", gap: 10 }}>
              {palette.map((c) => <button key={c} onClick={() => setColor(c)} style={{ width: 36, height: 36, borderRadius: 18, background: c, border: color === c ? "3px solid #fff" : "none", cursor: "pointer" }} />)}
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
                    <div style={{ flex: 1 }}><div style={{ fontWeight: 700 }}>{c.name}</div><div style={{ fontSize: 12, color: C.sub }}>{c.type === "gasto" ? "Gasto" : "Ingreso"} · {PRIORIDADES.find((x) => x.id === c.prioridad)?.label}</div></div>
                    <button onClick={() => shared.deleteCategory(c.id)} style={{ background: "none", border: "none", color: C.faint, fontSize: 18, cursor: "pointer" }}>🗑</button>
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
