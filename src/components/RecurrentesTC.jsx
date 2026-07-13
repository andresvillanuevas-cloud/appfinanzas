import { useState } from "react";
import { C, CLP } from "../lib/theme";
import { todayKey, scheduledYaConfirmado } from "../engine/engine";
import { Sheet, Field, input, primaryBtn, Empty } from "./ui";

// ---- Gastos recurrentes a tarjeta de crédito (seguros, suscripciones) ----
// Distinto de Programados: al APROBAR no se toca dinero real — se genera una
// cuotaTC 1/1 del mes (sube el por-facturar de la TC y consume presupuesto de
// su categoría). Crear/editar aquí NUNCA genera movimiento; solo "Aprobar".
export function RecurrentesTC({ shared, close }) {
  const cards = shared.accounts.filter((a) => a.type === "tarjeta");
  const gastoCats = shared.categories.filter((c) => c.type === "gasto");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [cardId, setCardId] = useState(cards[0]?.id || "");
  const [categoryId, setCategoryId] = useState("");
  const [day, setDay] = useState("");
  const [confirmAgain, setConfirmAgain] = useState(null); // id del recurrente a re-aprobar

  const recurrentes = shared.scheduled.filter((s) => s.targetType === "tarjeta");
  const aprobadoEsteMes = (s) => scheduledYaConfirmado(shared.movements, s, todayKey());

  if (!cards.length) {
    return (
      <Sheet title="Gastos recurrentes" close={close}>
        <Empty icon="💳" title="No tienes tarjetas" sub="Los gastos recurrentes se cargan a una tarjeta de crédito. Crea una primero desde Cuentas." />
      </Sheet>
    );
  }

  const valid = name.trim() && Number(amount) > 0 && cardId && categoryId;
  const add = () => {
    if (!valid) return;
    shared.addScheduled({
      name: name.trim(), merchant: name.trim(), kind: "gasto", amount: Number(amount),
      targetType: "tarjeta", cardId, categoryId,
      day: Math.min(31, Math.max(0, Number(day) || 0)) || null,
      frequency: "mensual", // única frecuencia con sentido aquí
    });
    setName(""); setAmount(""); setDay("");
    shared.notify("Gasto recurrente agregado");
  };

  return (
    <Sheet title="Gastos recurrentes" close={close} footer={<button disabled={!valid} onClick={add} style={primaryBtn(!valid)}>Agregar gasto recurrente</button>}>
      <div style={{ background: C.tealSoft, borderRadius: 14, padding: 14, marginBottom: 16, fontSize: 13, color: C.green }}>
        🔒 Cobros que llegan a tu tarjeta cada mes (seguros, suscripciones). No tocan nada hasta que los apruebas — recién ahí se cargan a la tarjeta y a su categoría.
      </div>
      <Field label="Nombre / comercio"><input style={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Seguro auto Mapfre, Netflix" /></Field>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}><Field label="Monto"><input style={input} type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" /></Field></div>
        <div style={{ flex: 1 }}><Field label="Día de cobro (aprox.)"><input style={input} type="number" min="1" max="31" value={day} onChange={(e) => setDay(e.target.value)} placeholder="Día 5" /></Field></div>
      </div>
      <Field label="Tarjeta">
        <select style={{ ...input, appearance: "none" }} value={cardId} onChange={(e) => setCardId(e.target.value)}>
          {cards.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </Field>
      <Field label="Categoría (obligatoria)">
        <select style={{ ...input, appearance: "none" }} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">Elegir categoría</option>
          {gastoCats.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
        </select>
      </Field>
      <Field label="Se repite">
        <div style={{ background: C.card2, border: `1px solid ${C.line}`, borderRadius: 12, padding: "12px 16px", fontWeight: 700, fontSize: 13, color: C.sub }}>
          Cada mes (apruebas manualmente cada cobro)
        </div>
      </Field>

      {recurrentes.length > 0 && (
        <>
          <div style={{ fontWeight: 700, margin: "16px 0 10px" }}>Tus cobros mensuales ({recurrentes.length})</div>
          {recurrentes.map((s) => {
            const aprobado = aprobadoEsteMes(s);
            const preguntando = confirmAgain === s.id;
            return (
              <div key={s.id} style={{ background: C.card, borderRadius: 14, marginBottom: 8, border: `1px solid ${C.line}`, overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 14 }}>
                  <span style={{ width: 38, height: 38, borderRadius: 11, background: C.violetSoft, color: C.violet, display: "grid", placeItems: "center" }}>💳</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.name}</div>
                    <div style={{ fontSize: 12, color: C.sub, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {CLP(s.amount)} · {shared.acc(s.cardId)?.name || "—"} · {shared.cat(s.categoryId)?.name || "Sin categoría"}{s.day ? ` · día ${s.day}` : ""}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 700, marginTop: 2, color: aprobado ? C.green : C.orange }}>
                      {aprobado ? "✓ Aprobado este mes" : "Pendiente de aprobar"}
                    </div>
                  </div>
                  <button
                    onClick={() => (aprobado ? setConfirmAgain(s.id) : shared.confirmScheduled(s))}
                    style={{ background: aprobado ? C.card2 : C.teal, border: aprobado ? `1px solid ${C.line}` : "none", color: aprobado ? C.sub : "#fff", padding: "9px 14px", borderRadius: 12, fontWeight: 700, fontSize: 13, cursor: "pointer" }}
                  >Aprobar</button>
                  <button onClick={() => shared.deleteScheduled(s.id)} style={{ background: "none", border: "none", color: C.faint, fontSize: 16, cursor: "pointer", padding: "0 2px" }}>🗑</button>
                </div>
                {preguntando && (
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: C.orangeSoft, borderTop: `1px solid ${C.line}` }}>
                    <span style={{ flex: 1, fontSize: 13, color: C.orange, fontWeight: 700 }}>Ya lo aprobaste este mes. ¿Cargarlo otra vez a la tarjeta?</span>
                    <button onClick={() => setConfirmAgain(null)} style={{ background: C.card2, border: `1px solid ${C.line}`, color: C.txt, padding: "8px 12px", borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Cancelar</button>
                    <button onClick={() => { shared.confirmScheduled(s); setConfirmAgain(null); }} style={{ background: C.orange, border: "none", color: "#fff", padding: "8px 12px", borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Sí, de nuevo</button>
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}
    </Sheet>
  );
}
