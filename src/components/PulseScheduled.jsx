import { useState } from "react";
import { C, CLP } from "../lib/theme";
import { Sheet, Field, input, primaryBtn, Empty } from "./ui";

// ---- Pulso: conciliación esperado vs real, cuenta por cuenta ----
export function Pulse({ shared, close }) {
  const money = shared.accounts.filter((a) => a.type !== "tarjeta" && a.type !== "credito");
  const [reals, setReals] = useState({});
  const [step, setStep] = useState(0);
  if (!money.length) return <Sheet title="Pulso" close={close}><Empty icon="📊" title="Sin cuentas de dinero" sub="Agrega efectivo o banco para conciliar saldos." /></Sheet>;
  const cur = money[step];
  const esperado = shared.engine.bal[cur.id] || 0;
  const real = reals[cur.id] === undefined ? "" : reals[cur.id];
  const diff = real === "" ? 0 : Number(real) - esperado;

  const next = () => {
    if (diff !== 0) shared.pulseAdjust({ accountId: cur.id, diff });
    if (step < money.length - 1) setStep(step + 1);
    else { shared.notify("Revisión terminada"); close(); }
  };

  return (
    <Sheet title="Pulso" close={close} footer={<button onClick={next} style={primaryBtn(false)}>{step < money.length - 1 ? "Siguiente cuenta" : "Finalizar revisión"}</button>}>
      <div style={{ textAlign: "center", color: C.sub, fontSize: 13, marginBottom: 16 }}>Compara lo esperado con lo real. La corrección queda como movimiento trazable — sin ajustes silenciosos.</div>
      <div style={{ background: C.card, borderRadius: 18, padding: 20, border: `1px solid ${C.line}`, marginBottom: 14 }}>
        <div style={{ fontSize: 13, color: C.sub, marginBottom: 4 }}>Cuenta {step + 1}/{money.length}</div>
        <div style={{ fontWeight: 800, fontSize: 20, marginBottom: 16 }}>{cur.name}</div>
        <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1, background: C.blueSoft, borderRadius: 14, padding: 14 }}>
            <div style={{ fontSize: 12, color: C.blue, fontWeight: 700 }}>Esperado</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: C.blue }}>{CLP(esperado)}</div>
          </div>
          <div style={{ flex: 1, background: C.tealSoft, borderRadius: 14, padding: 14 }}>
            <div style={{ fontSize: 12, color: C.green, fontWeight: 700 }}>Real</div>
            <input type="number" min="0" value={real} onChange={(e) => setReals((p) => ({ ...p, [cur.id]: e.target.value }))} placeholder="Anota" style={{ width: "100%", boxSizing: "border-box", background: "transparent", border: "none", color: C.green, fontSize: 22, fontWeight: 800, outline: "none" }} />
          </div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 12, color: C.sub, fontWeight: 700 }}>DIFERENCIA</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: diff === 0 ? C.green : C.orange }}>{diff > 0 ? "+" : ""}{CLP(diff)}</div>
          <div style={{ fontSize: 13, color: C.sub }}>{diff === 0 ? "¡Todo cuadrado!" : diff < 0 ? "Se registrará como gasto" : "Se registrará como ingreso"}</div>
        </div>
      </div>
    </Sheet>
  );
}

const FREQ_LABEL = { unico: "Una vez", mensual: "Cada mes", semanal: "Cada semana" };

// ---- Programados: vista futura; no tocan saldo hasta confirmar ----
export function Scheduled({ shared, close }) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [kind, setKind] = useState("ingreso");
  const [frequency, setFrequency] = useState("mensual");
  const money = shared.accounts.filter((a) => a.type !== "tarjeta" && a.type !== "credito");
  const [accountId, setAccountId] = useState(money[0]?.id || "");

  const add = () => {
    if (!name.trim() || !amount) return;
    shared.addScheduled({ name: name.trim(), amount: Number(amount), kind, accountId, frequency });
    setName(""); setAmount("");
    shared.notify("Programado agregado");
  };

  return (
    <Sheet title="Programados" close={close} footer={<button onClick={add} style={primaryBtn(!name.trim() || !amount)}>Agregar programado</button>}>
      <div style={{ background: C.tealSoft, borderRadius: 14, padding: 14, marginBottom: 16, fontSize: 13, color: C.green }}>🔒 Vista futura: los programados no tocan tus saldos hasta que los confirmas.</div>
      <Field label="Nombre"><input style={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Sueldo, arriendo" /></Field>
      <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, color: C.sub, fontWeight: 700, marginBottom: 6 }}>TIPO</div>
          <div style={{ display: "flex", gap: 6 }}>
            {[["ingreso", "Ingreso"], ["gasto", "Gasto"]].map(([id, l]) => (
              <button key={id} onClick={() => setKind(id)} style={{ flex: 1, background: kind === id ? C.teal : C.card, border: `1px solid ${kind === id ? C.teal : C.line}`, color: kind === id ? "#fff" : C.sub, padding: "12px 0", borderRadius: 12, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>{l}</button>
            ))}
          </div>
        </div>
        <div style={{ flex: 1 }}><Field label="Monto"><input style={input} type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" /></Field></div>
      </div>
      <Field label="Se repite">
        <div style={{ display: "flex", gap: 6 }}>
          {[["unico", "Una vez"], ["mensual", "Cada mes"], ["semanal", "Cada semana"]].map(([id, l]) => (
            <button key={id} onClick={() => setFrequency(id)} style={{ flex: 1, background: frequency === id ? C.teal : C.card, border: `1px solid ${frequency === id ? C.teal : C.line}`, color: frequency === id ? "#fff" : C.sub, padding: "12px 0", borderRadius: 12, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>{l}</button>
          ))}
        </div>
      </Field>
      <Field label="Cuenta">
        <select style={{ ...input, appearance: "none" }} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          {money.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </Field>

      {shared.scheduled.length > 0 && (
        <>
          <div style={{ fontWeight: 700, margin: "16px 0 10px" }}>Vista futura ({shared.scheduled.length})</div>
          {shared.scheduled.map((s) => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 12, background: C.card, borderRadius: 14, padding: 14, marginBottom: 8, border: `1px solid ${C.line}` }}>
              <span style={{ width: 38, height: 38, borderRadius: 11, background: s.kind === "ingreso" ? C.tealSoft : C.redSoft, color: s.kind === "ingreso" ? C.green : C.red, display: "grid", placeItems: "center" }}>{s.kind === "ingreso" ? "↓" : "↑"}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700 }}>{s.name}</div>
                <div style={{ fontSize: 12, color: C.orange }}>{FREQ_LABEL[s.frequency] || "Cada mes"} · {CLP(s.amount)}</div>
              </div>
              <button onClick={() => shared.confirmScheduled(s)} style={{ background: C.teal, border: "none", color: "#fff", padding: "9px 14px", borderRadius: 12, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Confirmar</button>
              <button onClick={() => shared.deleteScheduled(s.id)} style={{ background: "none", border: "none", color: C.faint, fontSize: 16, cursor: "pointer", padding: "0 2px" }}>🗑</button>
            </div>
          ))}
        </>
      )}
    </Sheet>
  );
}
