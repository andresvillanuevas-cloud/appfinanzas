import { useEffect, useState } from "react";
import { C, CLP, keyToLabel } from "../lib/theme";
import { todayKey, addMonths, validateLinePayment, todayDateStr, dateStrToMonth, dateStrToTs } from "../engine/engine";
import { Sheet, Field, DateField, input, primaryBtn, Empty, MiniStat } from "./ui";

const RowSelect = ({ label, value, onClick }) => (
  <button onClick={onClick} style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", background: C.card2, border: `1px solid ${C.line}`, borderRadius: 14, padding: "13px 16px", color: C.txt, marginBottom: 12, cursor: "pointer" }}>
    <span><span style={{ fontSize: 12, color: C.sub, display: "block", textAlign: "left" }}>{label}</span><span style={{ fontWeight: 700 }}>{value}</span></span>
    <span style={{ color: C.faint }}>⇅</span>
  </button>
);

// ---- Registro rápido (gasto/ingreso con parser simple) ----
export function QuickAdd({ shared, close }) {
  const [raw, setRaw] = useState("");
  const [type, setType] = useState("gasto");
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState(shared.accounts.find((a) => a.type !== "tarjeta" && a.type !== "credito")?.id || "");
  const [categoryId, setCategoryId] = useState("");
  const [merchant, setMerchant] = useState("");
  const [status, setStatus] = useState("confirmado");
  const [date, setDate] = useState(todayDateStr());

  // NLP simple: "Uber 8.500" → monto + comercio
  useEffect(() => {
    const m = raw.match(/([\d.]+)/);
    if (m) setAmount(m[1].replace(/\./g, ""));
    const words = raw.replace(/[\d.]+/g, "").trim();
    if (words) setMerchant(words);
  }, [raw]);

  const cats = shared.categories.filter((c) => c.type === type);
  const moneyAcc = shared.accounts.filter((a) => a.type !== "tarjeta" && a.type !== "credito");
  const valid = amount && Number(amount) > 0 && accountId;
  const save = () => {
    shared.addMovement({ kind: type, amount: Number(amount), accountId, categoryId: categoryId || null, merchant: merchant || (type === "gasto" ? "Gasto" : "Ingreso"), month: dateStrToMonth(date), ts: dateStrToTs(date), status });
    shared.notify(type === "gasto" ? "Gasto registrado" : "Ingreso registrado");
    close();
  };

  return (
    <Sheet title="Registro rápido" close={close} footer={<button disabled={!valid} onClick={save} style={primaryBtn(!valid)}>Guardar {type}</button>}>
      <Field label="Anota el movimiento">
        <input style={input} value={raw} onChange={(e) => setRaw(e.target.value)} placeholder="Ej: Uber 8.500" autoFocus />
      </Field>
      <DateField value={date} onChange={setDate} />
      <div style={{ background: C.card, borderRadius: 16, padding: 16, border: `1px solid ${C.line}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
          <span style={{ fontWeight: 700 }}>La app entendió</span>
          <span style={{ color: valid ? C.green : C.orange, fontWeight: 700 }}>{valid ? "Listo" : "Falta monto"}</span>
        </div>
        <RowSelect label="Tipo" value={type === "gasto" ? "Gasto" : "Ingreso"} onClick={() => setType(type === "gasto" ? "ingreso" : "gasto")} />
        <Field label="Monto"><input style={input} type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" /></Field>
        <Field label="Cuenta">
          {moneyAcc.length === 0 ? (
            <div style={{ background: C.orangeSoft, borderRadius: 12, padding: 13, fontSize: 13, color: C.txt, lineHeight: 1.45 }}>
              No tienes cuentas de dinero (efectivo, banco o ahorro).
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button onClick={() => { close(); shared.setModal({ type: "newAccount" }); }} style={{ flex: 1, background: C.teal, border: "none", color: "#fff", padding: "10px 0", borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Crear cuenta</button>
                <button onClick={() => { close(); shared.setModal({ type: "cardPurchase" }); }} style={{ flex: 1, background: C.card2, border: `1px solid ${C.line}`, color: C.txt, padding: "10px 0", borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Usar Gasto TC</button>
              </div>
              <div style={{ marginTop: 8, color: C.sub, fontSize: 12 }}>Los gastos con tarjeta van por "Gasto TC" para descontar cupo y armar las cuotas.</div>
            </div>
          ) : (
            <select style={{ ...input, appearance: "none" }} value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="">Elegir cuenta</option>
              {moneyAcc.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          )}
        </Field>
        <Field label="Categoría">
          <select style={{ ...input, appearance: "none" }} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Sin categoría</option>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
          </select>
        </Field>
        <Field label="Estado">
          <div style={{ display: "flex", gap: 8 }}>
            {[["confirmado", "Confirmado"], ["pendiente", "Pendiente"]].map(([id, l]) => (
              <button key={id} onClick={() => setStatus(id)} style={{ flex: 1, background: status === id ? C.tealSoft : C.card2, border: `1px solid ${status === id ? C.teal : C.line}`, color: status === id ? C.green : C.sub, padding: "11px 0", borderRadius: 12, fontWeight: 700, cursor: "pointer" }}>{l}</button>
            ))}
          </div>
        </Field>
      </div>
    </Sheet>
  );
}

// ---- Compra con tarjeta (cuotas 1–36, compra en curso, validación de cupo) ----
export function CardPurchase({ shared, close }) {
  const cards = shared.accounts.filter((a) => a.type === "tarjeta");
  const [cardId, setCardId] = useState(cards[0]?.id || "");
  const [merchant, setMerchant] = useState("");
  const [total, setTotal] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [cuotas, setCuotas] = useState(1);
  const [date, setDate] = useState(todayDateStr()); // fecha real de la compra (registro)
  const [firstNow, setFirstNow] = useState(true); // primera cuota se factura ahora o el próximo mes
  const [enCurso, setEnCurso] = useState(false);
  const [curIndex, setCurIndex] = useState(1); // próxima cuota a facturar
  const [note, setNote] = useState("");
  const gastoCats = shared.categories.filter((c) => c.type === "gasto");
  const card = shared.accounts.find((a) => a.id === cardId);
  const cupoDisp = card ? (card.cupo || 0) - (shared.engine.cardUsed[cardId] || 0) : 0;
  // misma matemática que el motor: round + ajuste en la primera cuota creada
  const per = total ? Math.round(Number(total) / cuotas) : 0;
  const rem = total ? Number(total) - per * cuotas : 0;
  const startIndex = enCurso ? Math.min(Math.max(1, curIndex), cuotas) : 1;
  const cuotasRestantes = cuotas - (startIndex - 1);
  const montoRestante = per * cuotasRestantes + rem; // lo que falta facturar

  if (!cards.length) return <Sheet title="Gasto con tarjeta" close={close}><Empty icon="💳" title="No tienes tarjetas" sub="Crea una tarjeta de crédito primero desde Cuentas." /></Sheet>;

  const valid = total && Number(total) > 0 && cardId && montoRestante <= cupoDisp && startIndex <= cuotas;
  const firstMonth = firstNow ? todayKey() : addMonths(todayKey(), 1);
  const save = () => {
    shared.registerCardPurchase({ cardId, merchant: merchant || "Compra", categoryId: categoryId || null, total: Number(total), cuotas, firstMonth, note, startIndex, ts: dateStrToTs(date) });
    close();
  };

  return (
    <Sheet title="Gasto con tarjeta de crédito" close={close} footer={<button disabled={!valid} onClick={save} style={primaryBtn(!valid)}>Registrar compra</button>}>
      <div style={{ background: C.card, borderRadius: 16, padding: 16, marginBottom: 14, border: `1px solid ${C.line}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <span style={{ width: 42, height: 42, borderRadius: 12, background: C.tealSoft, color: C.green, display: "grid", placeItems: "center", fontSize: 18 }}>💳</span>
          <div><div style={{ fontWeight: 700 }}>Compra con tarjeta</div><div style={{ color: C.sub, fontSize: 13 }}>Cupo, cuotas y presupuesto en una sola vista.</div></div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <MiniStat label="Tarjeta" value={card?.name || "—"} />
          <MiniStat label="Plan" value={`${cuotas} ${cuotas === 1 ? "cuota" : "cuotas"} · ${firstNow ? "ahora" : "diferida"}`} />
          <MiniStat label="Cupo disp." value={CLP(cupoDisp)} />
          <MiniStat label="Cuota" value={CLP(per)} />
        </div>
      </div>

      <Field label="Tarjeta">
        <select style={{ ...input, appearance: "none" }} value={cardId} onChange={(e) => setCardId(e.target.value)}>
          {cards.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </Field>
      <Field label="Comercio"><input style={input} value={merchant} onChange={(e) => setMerchant(e.target.value)} placeholder="Ej. Supermercado, restaurante" /></Field>
      <Field label="Monto total"><input style={input} type="number" min="0" value={total} onChange={(e) => setTotal(e.target.value)} placeholder="0" /></Field>
      {total && montoRestante > cupoDisp ? <div style={{ background: C.redSoft, color: C.red, borderRadius: 12, padding: 12, fontSize: 13, marginBottom: 12 }}>⚠ Lo que falta facturar ({CLP(montoRestante)}) excede el cupo disponible ({CLP(cupoDisp)}).</div> : null}
      <Field label="Categoría">
        <select style={{ ...input, appearance: "none" }} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          <option value="">Sin categoría</option>
          {gastoCats.map((c) => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
        </select>
      </Field>

      <Field label="Plan de pago">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginBottom: 10 }}>
          {[1, 2, 3, 6, 12, 18, 24, 36].map((n) => (
            <button key={n} onClick={() => setCuotas(n)} style={{ background: cuotas === n ? C.teal : C.card, border: `1px solid ${cuotas === n ? C.teal : C.line}`, color: cuotas === n ? "#fff" : C.txt, padding: "12px 0", borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: "pointer" }}>{n}</button>
          ))}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <span style={{ fontSize: 13, color: C.sub, fontWeight: 700 }}>Otra cantidad</span>
          <input style={{ ...input, width: 90, padding: "9px 12px" }} type="number" min="1" max="36" value={cuotas} onChange={(e) => setCuotas(Math.min(36, Math.max(1, Number(e.target.value) || 1)))} />
          <span style={{ fontSize: 13, color: C.faint }}>1–36</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setFirstNow(true)} style={{ flex: 1, background: firstNow ? C.tealSoft : C.card, border: `1px solid ${firstNow ? C.teal : C.line}`, color: firstNow ? C.green : C.sub, padding: "12px 0", borderRadius: 12, fontWeight: 700, cursor: "pointer" }}>Primera: Ahora</button>
          <button onClick={() => setFirstNow(false)} style={{ flex: 1, background: !firstNow ? C.tealSoft : C.card, border: `1px solid ${!firstNow ? C.teal : C.line}`, color: !firstNow ? C.green : C.sub, padding: "12px 0", borderRadius: 12, fontWeight: 700, cursor: "pointer" }}>Diferida (+1 mes)</button>
        </div>
      </Field>
      <DateField label="Fecha de compra (cuándo la hiciste)" value={date} onChange={setDate} />

      {/* compra ya en curso */}
      <Field label="¿Es una compra ya en curso?">
        <div style={{ display: "flex", gap: 8, marginBottom: enCurso ? 12 : 0 }}>
          <button onClick={() => setEnCurso(false)} style={{ flex: 1, background: !enCurso ? C.tealSoft : C.card, border: `1px solid ${!enCurso ? C.teal : C.line}`, color: !enCurso ? C.green : C.sub, padding: "12px 0", borderRadius: 12, fontWeight: 700, cursor: "pointer" }}>Compra nueva</button>
          <button onClick={() => setEnCurso(true)} style={{ flex: 1, background: enCurso ? C.orangeSoft : C.card, border: `1px solid ${enCurso ? C.orange : C.line}`, color: enCurso ? C.orange : C.sub, padding: "12px 0", borderRadius: 12, fontWeight: 700, cursor: "pointer" }}>Ya voy pagando</button>
        </div>
        {enCurso && (
          <div style={{ background: C.orangeSoft, borderRadius: 12, padding: 14 }}>
            <div style={{ fontSize: 13, color: C.sub, marginBottom: 10 }}>Indica la próxima cuota a facturar. Se cargarán solo las que faltan hacia adelante.</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontWeight: 700 }}>Próxima cuota</span>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <button onClick={() => setCurIndex((v) => Math.max(1, v - 1))} style={{ width: 34, height: 34, borderRadius: 17, background: C.card, border: `1px solid ${C.line}`, color: C.txt, fontSize: 18, cursor: "pointer" }}>−</button>
                <span style={{ fontWeight: 800, fontSize: 18, minWidth: 60, textAlign: "center" }}>{startIndex} / {cuotas}</span>
                <button onClick={() => setCurIndex((v) => Math.min(cuotas, v + 1))} style={{ width: 34, height: 34, borderRadius: 17, background: C.card, border: `1px solid ${C.line}`, color: C.txt, fontSize: 18, cursor: "pointer" }}>+</button>
              </div>
            </div>
            <div style={{ fontSize: 13, color: C.orange, marginTop: 10, fontWeight: 700 }}>
              Faltan {cuotasRestantes} cuota{cuotasRestantes !== 1 ? "s" : ""} · {CLP(montoRestante)} por facturar
            </div>
          </div>
        )}
      </Field>

      {total ? (
        <div style={{ background: C.blueSoft, borderRadius: 14, padding: 14, marginBottom: 8 }}>
          <div style={{ fontWeight: 700, marginBottom: 8, color: C.blue }}>🗓 Cuotas por venir</div>
          {Array.from({ length: Math.min(cuotasRestantes, 4) }).map((_, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 14, marginBottom: 4 }}>
              <span style={{ color: C.sub }}>Cuota {startIndex + i}/{cuotas} · {keyToLabel(addMonths(firstNow ? todayKey() : addMonths(todayKey(), 1), i))}{i === 0 && firstNow ? " · Este mes" : ""}</span>
              <span style={{ fontWeight: 700 }}>{CLP(per + (i === 0 ? rem : 0))}</span>
            </div>
          ))}
          {cuotasRestantes > 4 && <div style={{ fontSize: 12, color: C.faint }}>+ {cuotasRestantes - 4} cuotas más…</div>}
        </div>
      ) : null}
      <Field label="Nota"><input style={input} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ej. Cuotas sin interés" /></Field>
    </Sheet>
  );
}

// ---- Pagar tarjeta ----
export function PayCard({ shared, close }) {
  const cards = shared.accounts.filter((a) => a.type === "tarjeta");
  const money = shared.accounts.filter((a) => a.type !== "tarjeta" && a.type !== "credito");
  const [cardId, setCardId] = useState(cards[0]?.id || "");
  const [fromId, setFromId] = useState(money[0]?.id || "");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayDateStr());
  const facturar = shared.engine.cardUsed[cardId] || 0;
  const real = shared.engine.bal[fromId] || 0;
  const disp = shared.engine.avail[fromId] || 0; // real + línea disponible
  const fromAcc = shared.accounts.find((a) => a.id === fromId);

  if (!cards.length) return <Sheet title="Pagar tarjeta" close={close}><Empty icon="💳" title="No tienes tarjetas" sub="Crea una tarjeta primero." /></Sheet>;
  const n = Number(amount) || 0;
  const usaLinea = n > real; // parte del pago sale de la línea
  const lineaUsada = usaLinea ? Math.min(n - real, fromAcc?.line || 0) : 0;
  const valid = amount && n > 0 && n <= disp && fromId;
  const save = () => { shared.payCard({ cardId, fromId, amount: n, month: dateStrToMonth(date), ts: dateStrToTs(date) }); close(); };

  return (
    <Sheet title="Pagar tarjeta de crédito" close={close} footer={<button disabled={!valid} onClick={save} style={primaryBtn(!valid)}>{valid || !amount ? "Registrar pago" : "Excede saldo + línea"}</button>}>
      <div style={{ background: C.card, borderRadius: 16, padding: 16, marginBottom: 14, border: `1px solid ${C.line}` }}>
        <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 4 }}>Pago de factura</div>
        <div style={{ color: C.sub, fontSize: 13 }}>Baja la deuda de la tarjeta y descuenta dinero de la cuenta origen. No es un gasto nuevo.</div>
      </div>
      <Field label="Tarjeta a pagar">
        <select style={{ ...input, appearance: "none" }} value={cardId} onChange={(e) => setCardId(e.target.value)}>
          {cards.map((a) => <option key={a.id} value={a.id}>{a.name} — por facturar {CLP(shared.engine.cardUsed[a.id] || 0)}</option>)}
        </select>
      </Field>
      <Field label="Pagar desde">
        <select style={{ ...input, appearance: "none" }} value={fromId} onChange={(e) => setFromId(e.target.value)}>
          {money.map((a) => {
            const r = shared.engine.bal[a.id] || 0;
            const av = shared.engine.avail[a.id] || 0;
            const extra = av > r ? ` (+línea ${CLP(av - r)})` : "";
            return <option key={a.id} value={a.id}>{a.name} — disp. {CLP(r)}{extra}</option>;
          })}
        </select>
      </Field>
      <Field label="Monto"><input style={input} type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={String(facturar || 0)} /></Field>
      <DateField value={date} onChange={setDate} />
      {usaLinea && n <= disp && (
        <div style={{ background: C.blueSoft, color: C.blue, borderRadius: 12, padding: 12, fontSize: 13 }}>ℹ Usarás {CLP(lineaUsada)} de la línea de {fromAcc?.name}. El saldo quedará en {CLP(real - n)} (línea usada). Podrás pagar esa línea después con dinero real.</div>
      )}
      {n > disp && <div style={{ background: C.redSoft, color: C.red, borderRadius: 12, padding: 12, fontSize: 13 }}>⚠ Excede saldo + línea. Máximo disponible: {CLP(disp)}.</div>}
    </Sheet>
  );
}

// ---- Pagar crédito ----
export function PayCredit({ shared, close }) {
  const credits = shared.accounts.filter((a) => a.type === "credito");
  const money = shared.accounts.filter((a) => a.type !== "tarjeta" && a.type !== "credito");
  const [creditId, setCreditId] = useState(credits[0]?.id || "");
  const [fromId, setFromId] = useState(money[0]?.id || "");
  const credit = shared.accounts.find((a) => a.id === creditId);
  const [amount, setAmount] = useState(credit?.cuotaValue ? String(credit.cuotaValue) : "");
  const [date, setDate] = useState(todayDateStr());
  const real = shared.engine.bal[fromId] || 0;
  const disp = shared.engine.avail[fromId] || 0;
  const pend = shared.engine.debt[creditId] || 0;
  const fromAcc = shared.accounts.find((a) => a.id === fromId);

  if (!credits.length) return <Sheet title="Pagar crédito" close={close}><Empty icon="📄" title="No tienes créditos" sub="Crea un crédito primero desde Cuentas." /></Sheet>;
  const n = Number(amount) || 0;
  const usaLinea = n > real;
  const lineaUsada = usaLinea ? Math.min(n - real, fromAcc?.line || 0) : 0;
  const valid = amount && n > 0 && n <= disp && fromId;
  const save = () => { shared.payCredit({ creditId, fromId, amount: n, month: dateStrToMonth(date), ts: dateStrToTs(date) }); close(); };

  return (
    <Sheet title="Pagar crédito" close={close} footer={<button disabled={!valid} onClick={save} style={primaryBtn(!valid)}>{valid || !amount ? "Registrar pago" : "Excede saldo + línea"}</button>}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.sub, letterSpacing: 1 }}>DEUDA PENDIENTE</div>
        <div style={{ fontSize: 38, fontWeight: 800, color: C.teal }}>{CLP(pend)}</div>
        <div style={{ color: C.sub, fontSize: 13 }}>Cuota {CLP(credit?.cuotaValue || 0)} · Restan {credit?.cuotasRestantes || 0} cuotas</div>
      </div>
      <Field label="Crédito">
        <select style={{ ...input, appearance: "none" }} value={creditId} onChange={(e) => setCreditId(e.target.value)}>
          {credits.map((a) => <option key={a.id} value={a.id}>{a.name} — pend. {CLP(shared.engine.debt[a.id] || 0)}</option>)}
        </select>
      </Field>
      <Field label="Pagar desde">
        <select style={{ ...input, appearance: "none" }} value={fromId} onChange={(e) => setFromId(e.target.value)}>
          {money.map((a) => {
            const r = shared.engine.bal[a.id] || 0;
            const av = shared.engine.avail[a.id] || 0;
            const extra = av > r ? ` (+línea ${CLP(av - r)})` : "";
            return <option key={a.id} value={a.id}>{a.name} — disp. {CLP(r)}{extra}</option>;
          })}
        </select>
      </Field>
      <Field label="Monto"><input style={input} type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={String(credit?.cuotaValue || 0)} /></Field>
      <DateField value={date} onChange={setDate} />
      {usaLinea && n <= disp && (
        <div style={{ background: C.blueSoft, color: C.blue, borderRadius: 12, padding: 12, fontSize: 13 }}>ℹ Usarás {CLP(lineaUsada)} de la línea de {fromAcc?.name}. El saldo quedará en {CLP(real - n)} (línea usada).</div>
      )}
      {n > disp && <div style={{ background: C.redSoft, color: C.red, borderRadius: 12, padding: 12, fontSize: 13 }}>⚠ Excede saldo + línea. Máximo disponible: {CLP(disp)}.</div>}
    </Sheet>
  );
}

// ---- Pagar línea usada (solo dinero real) ----
export function PayLine({ shared, close }) {
  const banks = shared.accounts.filter((a) => (shared.engine.lineUsed[a.id] || 0) > 0);
  const money = shared.accounts.filter((a) => a.type !== "tarjeta" && a.type !== "credito");
  const [bankId, setBankId] = useState(banks[0]?.id || "");
  const others = money.filter((a) => a.id !== bankId);
  const [fromId, setFromId] = useState(others[0]?.id || "");
  const usada = shared.engine.lineUsed[bankId] || 0;
  const [amount, setAmount] = useState(usada ? String(usada) : "");
  const [date, setDate] = useState(todayDateStr());
  const real = shared.engine.bal[fromId] || 0; // pagar línea SOLO con dinero real

  if (!banks.length) return <Sheet title="Pagar línea" close={close}><Empty icon="🏦" title="No hay línea usada" sub="Cuando pagues una tarjeta o crédito con la línea de un banco, aquí podrás devolver ese dinero." /></Sheet>;
  const n = Number(amount) || 0;
  const v = validateLinePayment(shared.engine, bankId, fromId, n);
  const valid = amount && v.ok;
  const save = () => { shared.payLine({ bankId, fromId, amount: n, month: dateStrToMonth(date), ts: dateStrToTs(date) }); close(); };

  return (
    <Sheet title="Pagar línea usada" close={close} footer={<button disabled={!valid} onClick={save} style={primaryBtn(!valid)}>{valid || !amount ? "Registrar pago" : "Revisa monto y origen"}</button>}>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: C.sub, letterSpacing: 1 }}>LÍNEA USADA</div>
        <div style={{ fontSize: 38, fontWeight: 800, color: C.orange }}>{CLP(usada)}</div>
        <div style={{ color: C.sub, fontSize: 13 }}>La línea se paga solo con dinero real de otra cuenta.</div>
      </div>
      <Field label="Banco con línea usada">
        <select style={{ ...input, appearance: "none" }} value={bankId} onChange={(e) => { setBankId(e.target.value); setAmount(String(shared.engine.lineUsed[e.target.value] || 0)); }}>
          {banks.map((a) => <option key={a.id} value={a.id}>{a.name} — línea usada {CLP(shared.engine.lineUsed[a.id] || 0)}</option>)}
        </select>
      </Field>
      <Field label="Pagar desde (dinero real)">
        <select style={{ ...input, appearance: "none" }} value={fromId} onChange={(e) => setFromId(e.target.value)}>
          {others.map((a) => <option key={a.id} value={a.id}>{a.name} — disp. {CLP(shared.engine.bal[a.id] || 0)}</option>)}
        </select>
      </Field>
      <Field label="Monto"><input style={input} type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={String(usada)} /></Field>
      <DateField value={date} onChange={setDate} />
      {n > real && <div style={{ background: C.redSoft, color: C.red, borderRadius: 12, padding: 12, fontSize: 13 }}>⚠ La línea se paga con dinero real. {shared.acc(fromId)?.name} solo tiene {CLP(real)}.</div>}
      {n > usada && <div style={{ background: C.redSoft, color: C.red, borderRadius: 12, padding: 12, fontSize: 13 }}>⚠ El monto supera la línea usada ({CLP(usada)}).</div>}
    </Sheet>
  );
}

// ---- Transferencia entre cuentas ----
// (No estaba en el prototipo; sigue el mismo estilo. Puede usar la línea del
// banco origen, con el mismo aviso azul que los pagos.)
export function Transfer({ shared, close }) {
  const money = shared.accounts.filter((a) => a.type !== "tarjeta" && a.type !== "credito");
  const [fromId, setFromId] = useState(money[0]?.id || "");
  const [toId, setToId] = useState(money[1]?.id || "");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayDateStr());
  const real = shared.engine.bal[fromId] || 0;
  const disp = shared.engine.avail[fromId] || 0;
  const fromAcc = shared.accounts.find((a) => a.id === fromId);

  if (money.length < 2) return <Sheet title="Transferencia" close={close}><Empty icon="⇄" title="Necesitas dos cuentas de dinero" sub="Crea al menos dos cuentas (efectivo, banco, ahorro) para transferir entre ellas." /></Sheet>;
  const n = Number(amount) || 0;
  const usaLinea = n > real;
  const lineaUsada = usaLinea ? Math.min(n - real, fromAcc?.line || 0) : 0;
  const valid = amount && n > 0 && n <= disp && fromId && toId && fromId !== toId;
  const save = () => { shared.transfer({ fromId, toId, amount: n, month: dateStrToMonth(date), ts: dateStrToTs(date) }); close(); };

  return (
    <Sheet title="Transferencia entre cuentas" close={close} footer={<button disabled={!valid} onClick={save} style={primaryBtn(!valid)}>Transferir</button>}>
      <div style={{ background: C.card, borderRadius: 16, padding: 16, marginBottom: 14, border: `1px solid ${C.line}` }}>
        <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 4 }}>Mover dinero</div>
        <div style={{ color: C.sub, fontSize: 13 }}>Mueve dinero entre tus cuentas. No es un gasto ni consume presupuesto.</div>
      </div>
      <Field label="Desde">
        <select style={{ ...input, appearance: "none" }} value={fromId} onChange={(e) => {
          const v = e.target.value;
          setFromId(v);
          // si "Hacia" quedó apuntando a la misma cuenta, moverlo a otra
          if (v === toId) setToId(money.find((a) => a.id !== v)?.id || "");
        }}>
          {money.map((a) => <option key={a.id} value={a.id}>{a.name} — disp. {CLP(shared.engine.bal[a.id] || 0)}</option>)}
        </select>
      </Field>
      <Field label="Hacia">
        <select style={{ ...input, appearance: "none" }} value={toId} onChange={(e) => setToId(e.target.value)}>
          {money.filter((a) => a.id !== fromId).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      </Field>
      <Field label="Monto"><input style={input} type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" /></Field>
      <DateField value={date} onChange={setDate} />
      {fromId === toId && <div style={{ background: C.redSoft, color: C.red, borderRadius: 12, padding: 12, fontSize: 13 }}>⚠ Elige cuentas distintas.</div>}
      {usaLinea && n <= disp && (
        <div style={{ background: C.blueSoft, color: C.blue, borderRadius: 12, padding: 12, fontSize: 13 }}>ℹ Usarás {CLP(lineaUsada)} de la línea de {fromAcc?.name}. El saldo quedará en {CLP(real - n)} (línea usada).</div>
      )}
      {n > disp && <div style={{ background: C.redSoft, color: C.red, borderRadius: 12, padding: 12, fontSize: 13 }}>⚠ Excede saldo + línea. Máximo disponible: {CLP(disp)}.</div>}
    </Sheet>
  );
}
