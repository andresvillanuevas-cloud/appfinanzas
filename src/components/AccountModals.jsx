import { useState } from "react";
import { C, CLP, keyToLabel, keyToLabelLargo, MESES, ACCOUNT_TYPES } from "../lib/theme";
import { todayKey, projectedCardPayments, cardStatement } from "../engine/engine";
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
  const pos = (v) => Math.max(0, Number(v) || 0); // nunca negativo
  const create = () => {
    shared.addAccount({
      type, name: name.trim(), color,
      initial: pos(initial),
      cupo: pos(cupo),
      line: pos(line),
      cierre: pos(cierre) || 24,
      venc: pos(venc),
      cuotaValue: pos(cuotaValue),
      cuotasRestantes: pos(cuotasRestantes),
      pagoDia: pos(pagoDia),
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
        <Field label="Saldo inicial (lo que ves hoy)"><input style={input} type="number" min="0" value={initial} onChange={(e) => setInitial(e.target.value)} placeholder="0" /></Field>
      )}
      {type === "banco" && (
        <Field label="Línea disponible (opcional)"><input style={input} type="number" min="0" value={line} onChange={(e) => setLine(e.target.value)} placeholder="0" /></Field>
      )}
      {type === "tarjeta" && (
        <>
          <Field label="Cupo total"><input style={input} type="number" min="0" value={cupo} onChange={(e) => setCupo(e.target.value)} placeholder="5.000.000" /></Field>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}><Field label="Día cierre"><input style={input} type="number" min="0" value={cierre} onChange={(e) => setCierre(e.target.value)} placeholder="Día 1" /></Field></div>
            <div style={{ flex: 1 }}><Field label="Día venc."><input style={input} type="number" min="0" value={venc} onChange={(e) => setVenc(e.target.value)} placeholder="Día 10" /></Field></div>
          </div>
        </>
      )}
      {type === "credito" && (
        <>
          <div style={{ background: C.orangeSoft, borderRadius: 14, padding: 14, marginBottom: 14, fontSize: 13, color: C.sub }}>Ingresa el valor de la cuota y cuántas quedan. La app calcula el total por pagar.</div>
          <Field label="Valor cuota"><input style={input} type="number" min="0" value={cuotaValue} onChange={(e) => setCuotaValue(e.target.value)} placeholder="500.000" /></Field>
          <Field label="Cuotas restantes"><input style={input} type="number" min="0" value={cuotasRestantes} onChange={(e) => setCuotasRestantes(e.target.value)} placeholder="6" /></Field>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}><Field label="Día de pago"><input style={input} type="number" min="0" value={pagoDia} onChange={(e) => setPagoDia(e.target.value)} placeholder="Día 5" /></Field></div>
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

const STATEMENT_TABS = [
  ["todos", "Todos"],
  ["porConfirmar", "Por confirmar"],
  ["compras", "Compras"],
];

// ---- Detalle de cuenta ----
export function AccountDetail({ shared, accountId, close }) {
  const [confirmDel, setConfirmDel] = useState(false);
  const [statMonth, setStatMonth] = useState(todayKey());
  const [statTab, setStatTab] = useState("todos");
  const a = shared.accounts.find((x) => x.id === accountId);
  if (!a) return null;
  const isCard = a.type === "tarjeta";
  const isCredit = a.type === "credito";
  const movs = shared.movements.filter((m) => (m.accountId === accountId || m.fromId === accountId || m.toId === accountId || m.cardId === accountId || m.creditId === accountId || m.bankId === accountId));

  const facturar = isCard ? shared.engine.cardUsed[accountId] || 0 : 0;
  const cupoDisp = isCard ? (a.cupo || 0) - facturar : 0;
  const uso = isCard && a.cupo ? Math.round((facturar / a.cupo) * 100) : 0;

  // Pagos proyectados: cuotas TC (mes actual en adelante) agrupadas por mes.
  const proyectados = isCard ? projectedCardPayments(shared.movements, accountId, todayKey()) : [];

  // Estado de cuenta: desglose del mes navegable + lista filtrable por tab.
  const statement = isCard ? cardStatement(shared.movements, accountId, statMonth) : null;
  const statementList = !statement ? [] : statTab === "compras"
    ? statement.compras
    : statTab === "porConfirmar"
    ? statement.compras.filter((m) => m.status === "pendiente")
    : [...statement.compras, ...statement.pagos].sort((x, y) => (y.ts || 0) - (x.ts || 0));
  const mesAbrev = MESES[Number(statMonth.split("-")[1]) - 1];

  // Compras en cuotas "en curso": las cuotas que ya se pagaron ANTES de
  // registrar la compra (1..startIndex-1) no existen como movimientos; se
  // reconstruyen para mostrarlas como historial. Se agrupan por purchaseGroup.
  const comprasEnCurso = isCard ? Object.values(
    movs.filter((m) => m.kind === "cuotaTC" && m.purchaseGroup).reduce((acc, m) => {
      const g = (acc[m.purchaseGroup] ||= { group: m.purchaseGroup, merchant: m.merchant, total: m.cuotasTotal, minIdx: m.cuotaIndex, maxIdx: m.cuotaIndex, perAmount: m.amount });
      g.minIdx = Math.min(g.minIdx, m.cuotaIndex);
      if (m.cuotaIndex > g.maxIdx) { g.maxIdx = m.cuotaIndex; g.perAmount = m.amount; } // la última cuota lleva el "per" base (sin remanente)
      return acc;
    }, {})
  ).filter((g) => g.minIdx > 1) : [];

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
          {/* Deuda total: lo que realmente debes hoy — es el número que manda. */}
          <div style={{ background: C.orangeSoft, border: `1px solid ${C.orange}`, borderRadius: 18, padding: 18, marginBottom: 14 }}>
            <div style={{ fontSize: 12, color: C.orange, fontWeight: 700, letterSpacing: 0.5 }}>DEUDA TOTAL (por facturar)</div>
            <div style={{ fontSize: 38, fontWeight: 800, color: C.orange }}>{CLP(facturar)}</div>
            <div style={{ color: C.sub, fontSize: 12, marginTop: 2 }}>Cupo disponible {CLP(cupoDisp)} de {CLP(a.cupo || 0)}</div>
          </div>
          <div style={{ background: C.card, borderRadius: 16, padding: 16, marginBottom: 14, border: `1px solid ${C.line}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}><span style={{ fontWeight: 700 }}>Uso de cupo</span><span style={{ fontWeight: 700 }}>{uso}%</span></div>
            <div style={{ height: 6, background: C.card2, borderRadius: 3, marginBottom: 12 }}><div style={{ height: 6, width: `${Math.min(100, uso)}%`, background: uso >= 100 ? C.red : C.teal, borderRadius: 3 }} /></div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <div><div style={{ color: C.sub, fontWeight: 700 }}>POR FACTURAR</div><div>{CLP(facturar)}</div></div>
              <div><div style={{ color: C.sub, fontWeight: 700 }}>CUPO TOTAL</div><div>{CLP(a.cupo || 0)}</div></div>
              <div><div style={{ color: C.sub, fontWeight: 700 }}>DISPONIBLE</div><div style={{ color: cupoDisp < 0 ? C.red : C.txt }}>{CLP(cupoDisp)}</div></div>
            </div>
          </div>
          {(a.cierre || a.venc) && (
            <div style={{ background: C.card, borderRadius: 14, padding: 14, marginBottom: 14, border: `1px solid ${C.line}`, display: "flex", justifyContent: "space-between" }}>
              <div><div style={{ fontSize: 11, color: C.sub, fontWeight: 700 }}>DÍA CIERRE</div><div style={{ fontWeight: 700 }}>{a.cierre || "—"}</div></div>
              <div style={{ textAlign: "right" }}><div style={{ fontSize: 11, color: C.sub, fontWeight: 700 }}>DÍA VENCIMIENTO</div><div style={{ fontWeight: 700 }}>{a.venc || "—"}</div></div>
            </div>
          )}

          {/* Pagos proyectados: cuotas TC que vienen, agrupadas por mes */}
          {proyectados.length > 0 && (
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontWeight: 700, marginBottom: 10 }}>Pagos proyectados</div>
              {proyectados.map(({ month, total }) => (
                <div key={month} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: C.card, borderRadius: 14, padding: "12px 14px", marginBottom: 8, border: `1px solid ${C.line}` }}>
                  <span style={{ fontWeight: 600 }}>{keyToLabelLargo(month)}</span>
                  <span style={{ fontWeight: 800, color: C.orange }}>{CLP(total)}</span>
                </div>
              ))}
            </div>
          )}

          {/* Estado de cuenta: período navegable + 4 stats + tabs */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
              <div>
                <div style={{ fontWeight: 700 }}>Periodo y movimientos</div>
                <div style={{ color: C.sub, fontSize: 12 }}>Cierre {a.cierre || "—"} {mesAbrev}. · vence {a.venc || "—"} {mesAbrev}.</div>
              </div>
              <MonthNav value={statMonth} onChange={setStatMonth} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, margin: "12px 0" }}>
              <div style={{ background: C.card2, borderRadius: 12, padding: 12 }}>
                <div style={{ fontSize: 11, color: C.sub, fontWeight: 700 }}>CONFIRMADAS</div>
                <div style={{ fontWeight: 800, color: C.violet }}>{CLP(statement.confirmadas)}</div>
              </div>
              <div style={{ background: C.card2, borderRadius: 12, padding: 12 }}>
                <div style={{ fontSize: 11, color: C.sub, fontWeight: 700 }}>POR CONFIRMAR</div>
                <div style={{ fontWeight: 800, color: C.orange }}>{CLP(statement.porConfirmar)}</div>
              </div>
              <div style={{ background: C.card2, borderRadius: 12, padding: 12 }}>
                <div style={{ fontSize: 11, color: C.sub, fontWeight: 700 }}>ABONADO</div>
                <div style={{ fontWeight: 800, color: C.green }}>{CLP(statement.abonado)}</div>
              </div>
              <div style={{ background: C.card2, borderRadius: 12, padding: 12 }}>
                <div style={{ fontSize: 11, color: C.sub, fontWeight: 700 }}>POR PAGAR</div>
                <div style={{ fontWeight: 800, color: C.orange }}>{CLP(statement.porPagar)}</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, marginBottom: 12, overflowX: "auto" }}>
              {STATEMENT_TABS.map(([id, label]) => (
                <button key={id} onClick={() => setStatTab(id)} style={{ flexShrink: 0, background: statTab === id ? C.teal : C.card, border: `1px solid ${statTab === id ? C.teal : C.line}`, color: statTab === id ? "#fff" : C.sub, padding: "9px 16px", borderRadius: 20, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>{label}</button>
              ))}
            </div>
            {statementList.length === 0 ? (
              <div style={{ background: C.card2, borderRadius: 14, padding: 20, textAlign: "center", color: C.sub }}>Sin movimientos en este período.</div>
            ) : statementList.map((m) => (
              <MovRow key={m.id} m={m} acc={shared.acc} onDelete={shared.removeMovement} onOpen={(mov) => shared.setModal({ type: "movementDetail", movement: mov })} />
            ))}
          </div>
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

      {comprasEnCurso.length > 0 && (
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Cuotas ya pagadas</div>
          <div style={{ color: C.sub, fontSize: 12, marginBottom: 10 }}>De compras que registraste ya en curso (antes no tocaron esta app).</div>
          {comprasEnCurso.map((p) => (
            <div key={p.group} style={{ background: C.card, borderRadius: 14, padding: 14, marginBottom: 8, border: `1px solid ${C.line}` }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontWeight: 700 }}>{p.merchant}</span>
                <span style={{ color: C.sub, fontSize: 13 }}>{p.total} cuotas</span>
              </div>
              {Array.from({ length: p.minIdx - 1 }).map((_, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: C.faint, padding: "3px 0" }}>
                  <span>Cuota {i + 1}/{p.total} · ya pagada</span>
                  <span>{CLP(p.perAmount)}</span>
                </div>
              ))}
              <div style={{ fontSize: 12, color: C.green, fontWeight: 700, marginTop: 6 }}>✓ {p.minIdx - 1} cuota{p.minIdx - 1 > 1 ? "s" : ""} pagada{p.minIdx - 1 > 1 ? "s" : ""} antes de registrar</div>
            </div>
          ))}
        </div>
      )}

      {/* Para tarjetas, "Estado de cuenta" (arriba) ya muestra los movimientos
          filtrados por período — no repetir la lista plana. */}
      {!isCard && (
        <>
          <div style={{ fontWeight: 700, marginBottom: 10 }}>Movimientos</div>
          {movs.length === 0 ? (
            <div style={{ background: C.card2, borderRadius: 14, padding: 20, textAlign: "center", color: C.sub }}>Sin movimientos en esta cuenta.</div>
          ) : movs.map((m) => <MovRow key={m.id} m={m} acc={shared.acc} onDelete={shared.removeMovement} onOpen={(mov) => shared.setModal({ type: "movementDetail", movement: mov })} />)}
        </>
      )}

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
