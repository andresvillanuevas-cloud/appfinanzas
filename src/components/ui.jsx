import { useState } from "react";
import { C, CLP, keyToLabel } from "../lib/theme";
import { addMonths, todayDateStr } from "../engine/engine";

/* Primitivas UI portadas del prototipo cuadra.jsx.
   Los SF Symbols de iOS (glifos 􀀀…) se reemplazan por emoji/unicode
   equivalentes porque no renderizan fuera de Apple. */

export const Card = ({ children, style, onClick }) => (
  <div onClick={onClick} style={{ background: C.card, borderRadius: 20, padding: 16, border: `1px solid ${C.line}`, ...style }}>{children}</div>
);

export const Eyebrow = ({ children }) => (
  <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, color: C.sub, textTransform: "uppercase" }}>{children}</div>
);

export const Empty = ({ icon, title, sub, cta, onCta }) => (
  <Card style={{ textAlign: "center", padding: 28 }}>
    <div style={{ fontSize: 32, marginBottom: 8 }}>{icon}</div>
    <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{title}</div>
    <div style={{ color: C.sub, fontSize: 14, marginBottom: cta ? 16 : 0, lineHeight: 1.4 }}>{sub}</div>
    {cta && <button onClick={onCta} style={{ background: C.teal, border: "none", color: "#fff", padding: "12px 22px", borderRadius: 24, fontWeight: 700, fontSize: 15, cursor: "pointer" }}>{cta}</button>}
  </Card>
);

export const SectionHead = ({ label, count, accent }) => (
  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
    <h2 style={{ fontSize: 20, fontWeight: 800, margin: 0 }}>{label}</h2>
    {count != null && <span style={{ width: 24, height: 24, borderRadius: 12, background: accent ? C.orangeSoft : C.tealSoft, color: accent || C.green, display: "grid", placeItems: "center", fontSize: 12, fontWeight: 700 }}>{count}</span>}
  </div>
);

export const MonthNav = ({ value, onChange }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 4, background: C.card2, borderRadius: 20, padding: "6px 10px" }}>
    <button onClick={() => onChange(addMonths(value, -1))} style={{ background: "none", border: "none", color: C.teal, fontSize: 18, width: 26, cursor: "pointer" }}>‹</button>
    <span style={{ fontWeight: 700, fontSize: 14, minWidth: 74, textAlign: "center" }}>{keyToLabel(value)}</span>
    <button onClick={() => onChange(addMonths(value, 1))} style={{ background: "none", border: "none", color: C.teal, fontSize: 18, width: 26, cursor: "pointer" }}>›</button>
  </div>
);

export function MovRow({ m, acc, onDelete, onOpen }) {
  const [confirm, setConfirm] = useState(false);
  const neg = ["gasto", "cuotaTC", "pagoTarjeta", "pagoCredito", "pagoLinea"].includes(m.kind);
  const isTransfer = m.kind === "transferencia";
  const label = isTransfer ? "Transferencia" : m.merchant || "Movimiento";
  const sub = isTransfer
    ? `${acc(m.fromId)?.name} → ${acc(m.toId)?.name}`
    : m.kind === "cuotaTC"
    ? `cuota ${m.cuotaIndex}/${m.cuotasTotal} · ${acc(m.accountId)?.name || ""}`
    : `${acc(m.accountId || m.fromId || m.cardId || m.creditId)?.name || ""}`;
  return (
    <div style={{ background: C.card, borderRadius: 16, marginBottom: 8, border: `1px solid ${C.line}`, overflow: "hidden" }}>
      <div
        onClick={onOpen ? () => onOpen(m) : undefined}
        style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", cursor: onOpen ? "pointer" : "default" }}
      >
        <span style={{ width: 40, height: 40, borderRadius: 12, background: isTransfer ? C.blueSoft : neg ? C.redSoft : C.tealSoft, color: isTransfer ? C.blue : neg ? C.red : C.green, display: "grid", placeItems: "center", fontSize: 16 }}>
          {isTransfer ? "⇄" : neg ? "💳" : "↓"}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{label}</div>
          <div style={{ color: C.sub, fontSize: 12, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sub}</div>
          {m.note && (
            <div style={{ color: C.faint, fontSize: 11, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>📝 {m.note}</div>
          )}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontWeight: 800, color: neg ? C.red : isTransfer ? C.blue : C.green }}>{neg ? "-" : "+"}{CLP(m.amount)}</div>
          <div style={{ fontSize: 11, color: m.status === "cuadrado" ? C.blue : C.sub }}>{m.status === "cuadrado" ? "✓ Cuadrado" : m.status === "confirmado" ? "✓" : "⏱ Pend."}</div>
        </div>
        {onDelete && !confirm && (
          <button onClick={(e) => { e.stopPropagation(); setConfirm(true); }} style={{ background: "none", border: "none", color: C.faint, fontSize: 16, cursor: "pointer", padding: "0 2px" }}>🗑</button>
        )}
      </div>
      {onDelete && confirm && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", background: C.redSoft, borderTop: `1px solid ${C.line}` }}>
          <span style={{ flex: 1, fontSize: 13, color: C.red, fontWeight: 700 }}>
            {m.kind === "cuotaTC" ? "¿Eliminar esta compra y todas sus cuotas?" : "¿Eliminar este movimiento?"}
          </span>
          <button onClick={() => setConfirm(false)} style={{ background: C.card2, border: `1px solid ${C.line}`, color: C.txt, padding: "8px 12px", borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Cancelar</button>
          <button onClick={() => { onDelete(m); }} style={{ background: C.red, border: "none", color: "#fff", padding: "8px 12px", borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Eliminar</button>
        </div>
      )}
    </div>
  );
}

// Detalle de un movimiento: muestra la nota completa (sin truncar) y el resto
// de campos relevantes. Solo lectura.
export function MovementDetail({ m, acc, cat, close }) {
  const neg = ["gasto", "cuotaTC", "pagoTarjeta", "pagoCredito", "pagoLinea"].includes(m.kind);
  const isTransfer = m.kind === "transferencia";
  const label = isTransfer ? "Transferencia" : m.merchant || "Movimiento";
  const cuentaLabel = isTransfer
    ? `${acc(m.fromId)?.name || "—"} → ${acc(m.toId)?.name || "—"}`
    : acc(m.accountId || m.fromId || m.cardId || m.creditId || m.bankId)?.name || "—";
  const estadoLabel = m.status === "cuadrado" ? "Cuadrado" : m.status === "confirmado" ? "Confirmado" : "Pendiente";
  const rows = [
    ["Cuenta", cuentaLabel],
    !isTransfer ? ["Categoría", cat(m.categoryId)?.name || "Sin categoría"] : null,
    m.kind === "cuotaTC" ? ["Cuota", `${m.cuotaIndex}/${m.cuotasTotal}`] : null,
    ["Mes", keyToLabel(m.month)],
    ["Fecha", m.ts ? new Date(m.ts).toLocaleDateString("es-CL") : "—"],
    ["Estado", estadoLabel],
  ].filter(Boolean);

  return (
    <Sheet title="Detalle del movimiento" close={close}>
      <div style={{ textAlign: "center", marginBottom: 20 }}>
        <div style={{ fontSize: 34, fontWeight: 800, color: neg ? C.red : isTransfer ? C.blue : C.green }}>{neg ? "-" : "+"}{CLP(m.amount)}</div>
        <div style={{ color: C.sub, fontSize: 14, marginTop: 4 }}>{label}</div>
      </div>
      <div style={{ background: C.card, borderRadius: 16, border: `1px solid ${C.line}`, overflow: "hidden", marginBottom: 16 }}>
        {rows.map(([k, v], i) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "12px 16px", borderBottom: i < rows.length - 1 ? `1px solid ${C.line}` : "none" }}>
            <span style={{ color: C.sub }}>{k}</span>
            <span style={{ fontWeight: 700 }}>{v}</span>
          </div>
        ))}
      </div>
      {m.note && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.sub, textTransform: "uppercase", marginBottom: 6 }}>Nota</div>
          <div style={{ background: C.card2, borderRadius: 14, padding: 14, color: C.txt, lineHeight: 1.5 }}>{m.note}</div>
        </div>
      )}
    </Sheet>
  );
}

export function Sheet({ title, close, children, footer }) {
  return (
    <div onClick={close} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 70, display: "flex", alignItems: "flex-end" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxHeight: "92%", background: C.bg2, borderTopLeftRadius: 26, borderTopRightRadius: 26, border: `1px solid ${C.line}`, display: "flex", flexDirection: "column" }}>
        <div style={{ display: "flex", alignItems: "center", padding: "16px 18px", borderBottom: `1px solid ${C.line}` }}>
          <button onClick={close} style={{ background: "none", border: "none", color: C.teal, fontSize: 16, fontWeight: 600, cursor: "pointer" }}>Cerrar</button>
          <div style={{ flex: 1, textAlign: "center", fontWeight: 700, fontSize: 17, marginRight: 50 }}>{title}</div>
        </div>
        <div style={{ overflowY: "auto", padding: 18, flex: 1 }}>{children}</div>
        {footer && <div style={{ padding: 16, borderTop: `1px solid ${C.line}` }}>{footer}</div>}
      </div>
    </div>
  );
}

export const Field = ({ label, children }) => (
  <div style={{ marginBottom: 14 }}>
    <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 0.5, color: C.sub, textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
    {children}
  </div>
);

// Selector de fecha reutilizable: por defecto hoy, no permite futuro
// (para eso están los Programados). value/onChange usan "YYYY-MM-DD".
export const DateField = ({ label = "Fecha", value, onChange }) => (
  <Field label={label}>
    <input
      type="date"
      style={input}
      value={value}
      max={todayDateStr()}
      onChange={(e) => e.target.value && onChange(e.target.value)}
    />
  </Field>
);

export const input = { width: "100%", boxSizing: "border-box", background: C.card, border: `1px solid ${C.line}`, borderRadius: 14, padding: "13px 16px", color: C.txt, fontSize: 16 };

export const primaryBtn = (disabled) => ({ width: "100%", background: disabled ? C.card2 : C.teal, border: "none", color: disabled ? C.faint : "#fff", padding: "16px 0", borderRadius: 16, fontWeight: 800, fontSize: 16, cursor: disabled ? "default" : "pointer" });

// Skeleton de carga: bloques que laten mientras llegan los datos de Supabase.
export function LoadingSkeleton() {
  const block = (h, w = "100%", mb = 12) => (
    <div style={{ height: h, width: w, background: C.card, borderRadius: 16, marginBottom: mb, animation: "mc-pulse 1.2s ease-in-out infinite" }} />
  );
  return (
    <div style={{ padding: "6px 16px" }}>
      <style>{"@keyframes mc-pulse{0%,100%{opacity:1}50%{opacity:.45}}"}</style>
      <div style={{ height: 20, width: 90, background: C.card, borderRadius: 8, margin: "6px auto 18px", animation: "mc-pulse 1.2s ease-in-out infinite" }} />
      {block(150, "100%", 16)}
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        {block(64, "50%", 0)}{block(64, "50%", 0)}
      </div>
      {block(70)}
      {block(120)}
    </div>
  );
}

export const MiniStat = ({ label, value }) => (
  <div style={{ background: C.card2, borderRadius: 12, padding: "10px 12px" }}>
    <div style={{ fontSize: 11, color: C.sub, fontWeight: 700, textTransform: "uppercase" }}>{label}</div>
    <div style={{ fontWeight: 700, fontSize: 14 }}>{value}</div>
  </div>
);
