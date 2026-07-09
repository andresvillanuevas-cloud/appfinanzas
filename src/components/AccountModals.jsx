import { useState } from "react";
import { C, CLP, keyToLabel, ACCOUNT_TYPES } from "../lib/theme";
import { todayKey } from "../engine/engine";
import { Sheet, Field, input, primaryBtn, MonthNav, MovRow } from "./ui";

// ---- Nueva cuenta (6 tipos con campos condicionales) ----
export function NewAccount({ shared, close }) {
  const [type, setType] = useState("efectivo");
  const [name, setName] = useState("");
  const [initial, setInitial] = useState("");
  const [cupo, setCupo] = useState("");
  const [line, setLine] = useState("");
  const [cierre, setCierre] = useState("");
  const [venc, setVenc] = useState("");
  const [cuotaValue, setCuotaValue] = useState("");
  const [cuotasRestantes, setCuotasRestantes] = useState("1");
  const [pagoDia, setPagoDia] = useState("");
  const [vencMonth, setVencMonth] = useState(todayKey());
  const [color, setColor] = useState(C.teal);
  const meta = ACCOUNT_TYPES.find((x) => x.id === type);
  const palette = [C.teal, C.blue, C.violet, C.green, C.orange, C.red];

  const valid = name.trim() && (type !== "tarjeta" || cupo) && (type !== "credito" || (cuotaValue && cuotasRestantes));
  const create = () => {
    shared.addAccount({
      type, name: name.trim(), color,
      initial: Number(initial) || 0,
      cupo: Number(cupo) || 0,
      line: Number(line) || 0,
      cierre: Number(cierre) || 24,
      venc: Number(venc) || 0,
      cuotaValue: Number(cuotaValue) || 0,
      cuotasRestantes: Number(cuotasRestantes) || 0,
      pagoDia: Number(pagoDia) || 0,
      vencMonth: type === "credito" ? vencMonth : null,
    });
    shared.notify("Cuenta creada");
    close();
  };

  return (
    <Sheet title="Nueva cuenta" close={close} footer={<button disabled={!valid} onClick={create} style={primaryBtn(!valid)}>Crear cuenta</button>}>
      <Field label="Tipo de cuenta">
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {ACCOUNT_TYPES.map((x) => (
            <button key={x.id} onClick={() => { setType(x.id); setColor(x.color); }} style={{ textAlign: "left", background: type === x.id ? `${x.color}22` : C.card, border: `1.5px solid ${type === x.id ? x.color : C.line}`, borderRadius: 14, padding: 14, color: C.txt, cursor: "pointer" }}>
              <div style={{ fontSize: 20, marginBottom: 6 }}>{x.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{x.label}</div>
              <div style={{ color: C.sub, fontSize: 12 }}>{x.sub}</div>
            </button>
          ))}
        </div>
      </Field>

      <Field label="Nombre"><input style={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. TC Chile, Efectivo, Mach" /></Field>

      <Field label="Color de cuenta">
        <div style={{ display: "flex", gap: 10 }}>
          {palette.map((c) => (
            <button key={c} onClick={() => setColor(c)} style={{ width: 36, height: 36, borderRadius: 18, background: c, border: color === c ? "3px solid #fff" : "none", cursor: "pointer" }} />
          ))}
        </div>
      </Field>

      {meta.kind === "money" && (
        <Field label="Saldo inicial (lo que ves hoy)"><input style={input} type="number" value={initial} onChange={(e) => setInitial(e.target.value)} placeholder="0" /></Field>
      )}
      {type === "banco" && (
        <Field label="Línea disponible (opcional)"><input style={input} type="number" value={line} onChange={(e) => setLine(e.target.value)} placeholder="0" /></Field>
      )}
      {type === "tarjeta" && (
        <>
          <Field label="Cupo total"><input style={input} type="number" value={cupo} onChange={(e) => setCupo(e.target.value)} placeholder="5.000.000" /></Field>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}><Field label="Día cierre"><input style={input} type="number" value={cierre} onChange={(e) => setCierre(e.target.value)} placeholder="Día 1" /></Field></div>
            <div style={{ flex: 1 }}><Field label="Día venc."><input style={input} type="number" value={venc} onChange={(e) => setVenc(e.target.value)} placeholder="Día 10" /></Field></div>
          </div>
        </>
      )}
      {type === "credito" && (
        <>
          <div style={{ background: C.orangeSoft, borderRadius: 14, padding: 14, marginBottom: 14, fontSize: 13, color: C.sub }}>Ingresa el valor de la cuota y cuántas quedan. La app calcula el total por pagar.</div>
          <Field label="Valor cuota"><input style={input} type="number" value={cuotaValue} onChange={(e) => setCuotaValue(e.target.value)} placeholder="500.000" /></Field>
          <Field label="Cuotas restantes"><input style={input} type="number" value={cuotasRestantes} onChange={(e) => setCuotasRestantes(e.target.value)} placeholder="6" /></Field>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}><Field label="Día de pago"><input style={input} type="number" value={pagoDia} onChange={(e) => setPagoDia(e.target.value)} placeholder="Día 5" /></Field></div>
            <div style={{ flex: 1.4 }}><Field label="Próximo vencimiento"><MonthNav value={vencMonth} onChange={setVencMonth} /></Field></div>
          </div>
          <div style={{ background: C.card, borderRadius: 14, padding: 14, display: "flex", alignItems: "center", gap: 12 }}>
            <span style={{ width: 40, height: 40, borderRadius: 12, background: C.orangeSoft, color: C.orange, display: "grid", placeItems: "center" }}>ƒ(x)</span>
            <div><div style={{ fontSize: 11, color: C.sub, fontWeight: 700 }}>TOTAL POR PAGAR</div><div style={{ fontSize: 22, fontWeight: 800, color: C.orange }}>{CLP((Number(cuotaValue) || 0) * (Number(cuotasRestantes) || 0))}</div></div>
          </div>
        </>
      )}
    </Sheet>
  );
}

// ---- Detalle de cuenta ----
export function AccountDetail({ shared, accountId, close }) {
  const [confirmDel, setConfirmDel] = useState(false);
  const a = shared.accounts.find((x) => x.id === accountId);
  if (!a) return null;
  const isCard = a.type === "tarjeta";
  const isCredit = a.type === "credito";
  const movs = shared.movements.filter((m) => (m.accountId === accountId || m.fromId === accountId || m.toId === accountId || m.cardId === accountId || m.creditId === accountId || m.bankId === accountId));

  const facturar = isCard ? shared.engine.cardUsed[accountId] || 0 : 0;
  const cupoDisp = isCard ? (a.cupo || 0) - facturar : 0;
  const uso = isCard && a.cupo ? Math.round((facturar / a.cupo) * 100) : 0;

  const del = async () => {
    const ok = await shared.deleteAccount(accountId);
    if (ok) {
      shared.setModal(null);
      shared.notify("Cuenta eliminada");
    }
  };

  return (
    <Sheet title={a.name} close={close}>
      {isCard ? (
        <>
          <div style={{ fontSize: 34, fontWeight: 800 }}>{CLP(cupoDisp)}</div>
          <div style={{ fontSize: 12, color: C.sub, fontWeight: 700, marginBottom: 14 }}>CUPO DISPONIBLE</div>
          <div style={{ background: C.card, borderRadius: 16, padding: 16, marginBottom: 14, border: `1px solid ${C.line}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}><span style={{ fontWeight: 700 }}>Uso de cupo</span><span style={{ fontWeight: 700 }}>{uso}%</span></div>
            <div style={{ height: 6, background: C.card2, borderRadius: 3, marginBottom: 12 }}><div style={{ height: 6, width: `${Math.min(100, uso)}%`, background: C.teal, borderRadius: 3 }} /></div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <div><div style={{ color: C.sub, fontWeight: 700 }}>USADO</div><div>{CLP(facturar)}</div></div>
              <div><div style={{ color: C.sub, fontWeight: 700 }}>POR FACTURAR</div><div>{CLP(facturar)}</div></div>
              <div><div style={{ color: C.sub, fontWeight: 700 }}>CUPO TOTAL</div><div>{CLP(a.cupo || 0)}</div></div>
            </div>
          </div>
          {(a.cierre || a.venc) && (
            <div style={{ background: C.card, borderRadius: 14, padding: 14, marginBottom: 14, border: `1px solid ${C.line}`, display: "flex", justifyContent: "space-between" }}>
              <div><div style={{ fontSize: 11, color: C.sub, fontWeight: 700 }}>DÍA CIERRE</div><div style={{ fontWeight: 700 }}>{a.cierre || "—"}</div></div>
              <div style={{ textAlign: "right" }}><div style={{ fontSize: 11, color: C.sub, fontWeight: 700 }}>DÍA VENCIMIENTO</div><div style={{ fontWeight: 700 }}>{a.venc || "—"}</div></div>
            </div>
          )}
        </>
      ) : isCredit ? (
        <>
          <div style={{ fontSize: 12, color: C.sub, fontWeight: 700 }}>DEUDA PENDIENTE</div>
          <div style={{ fontSize: 34, fontWeight: 800, color: C.orange, marginBottom: 4 }}>{CLP(shared.engine.debt[accountId] || 0)}</div>
          <div style={{ color: C.sub, fontSize: 13, marginBottom: 14 }}>Cuota {CLP(a.cuotaValue || 0)} · Restan {a.cuotasRestantes || 0} cuotas</div>
          <div style={{ background: C.card, borderRadius: 14, padding: 14, marginBottom: 14, border: `1px solid ${C.line}`, display: "flex", justifyContent: "space-between" }}>
            <div><div style={{ fontSize: 11, color: C.sub, fontWeight: 700 }}>PRÓX. VENCIMIENTO</div><div style={{ fontWeight: 700 }}>{a.vencMonth ? keyToLabel(a.vencMonth) : "—"}{a.pagoDia ? ` · día ${a.pagoDia}` : ""}</div></div>
            <div style={{ textAlign: "right" }}><div style={{ fontSize: 11, color: C.sub, fontWeight: 700 }}>CUOTAS RESTANTES</div><div style={{ fontWeight: 700 }}>{a.cuotasRestantes || 0}</div></div>
          </div>
        </>
      ) : (
        (() => {
          const b = shared.engine.bal[accountId] || 0;
          const usada = shared.engine.lineUsed[accountId] || 0;
          const lineaDisp = Math.max(0, (a.line || 0) - usada);
          return (
            <>
              <div style={{ fontSize: 34, fontWeight: 800, color: b < 0 ? C.orange : C.txt }}>{CLP(b)}</div>
              <div style={{ fontSize: 12, color: C.sub, fontWeight: 700, marginBottom: 16 }}>
                SALDO ACTUAL{a.line ? ` · Línea disp. ${CLP(lineaDisp)}` : ""}{usada > 0 ? ` · usada ${CLP(usada)}` : ""}
              </div>
            </>
          );
        })()
      )}

      <div style={{ fontWeight: 700, marginBottom: 10 }}>Movimientos</div>
      {movs.length === 0 ? (
        <div style={{ background: C.card2, borderRadius: 14, padding: 20, textAlign: "center", color: C.sub }}>Sin movimientos en esta cuenta.</div>
      ) : movs.map((m) => <MovRow key={m.id} m={m} acc={shared.acc} />)}

      {/* eliminar solo si no tiene movimientos, con confirmación */}
      {movs.length === 0 && !confirmDel && (
        <button onClick={() => setConfirmDel(true)} style={{ width: "100%", marginTop: 16, background: C.orangeSoft, border: `1px solid ${C.orange}`, color: C.orange, padding: 14, borderRadius: 14, fontWeight: 700, cursor: "pointer" }}>🗑 Eliminar cuenta</button>
      )}
      {movs.length === 0 && confirmDel && (
        <div style={{ marginTop: 16, background: C.redSoft, borderRadius: 14, padding: 14 }}>
          <div style={{ fontWeight: 700, marginBottom: 10, color: C.red }}>¿Eliminar "{a.name}"? Esta acción no se puede deshacer.</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setConfirmDel(false)} style={{ flex: 1, background: C.card2, border: `1px solid ${C.line}`, color: C.txt, padding: 12, borderRadius: 12, fontWeight: 700, cursor: "pointer" }}>Cancelar</button>
            <button onClick={del} style={{ flex: 1, background: C.red, border: "none", color: "#fff", padding: 12, borderRadius: 12, fontWeight: 700, cursor: "pointer" }}>Sí, eliminar</button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
