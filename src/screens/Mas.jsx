import { supabase } from "../lib/supabase";
import { C } from "../lib/theme";
import { Card } from "../components/ui";
import { exportCSV, exportXLSX } from "../lib/export";

export default function Mas({ session, accounts = [], categories = [], movements = [], scheduled = [], engine, setModal, notify }) {
  const data = { accounts, categories, movements, engine };
  const doExport = (fn, label) => {
    if (!movements.length) { notify?.("Aún no hay movimientos para exportar"); return; }
    fn(data);
    notify?.(`${label} exportado`);
  };
  const rows = [
    ["🗓", "Programados", `${scheduled.length} activos · no tocan saldo`, () => setModal({ type: "scheduled" })],
    ["🏷️", "Categorías", `${categories.length} activas`, () => setModal({ type: "categories" })],
    ["📊", "Pulso", "Esperado vs Real", () => setModal({ type: "pulse" })],
    ["📄", "Exportar a Excel (.xlsx)", "Respaldo con movimientos y cuentas", () => doExport(exportXLSX, "Excel")],
    ["📤", "Exportar a CSV", "Abre en Excel con tildes", () => doExport(exportCSV, "CSV")],
    ["🌎", "Moneda principal", "CLP · Peso Chileno", null],
  ];
  return (
    <div style={{ padding: "6px 16px" }}>
      <div style={{ borderRadius: 24, padding: 20, background: `linear-gradient(150deg,${C.tealDim},${C.blue})`, marginBottom: 16 }}>
        <div style={{ fontSize: 32, fontWeight: 800, marginBottom: 2 }}>Centro de control</div>
        <div style={{ opacity: 0.8, fontSize: 13, marginBottom: 16 }}>{session?.user?.email}</div>
        <div style={{ display: "flex", gap: 8 }}>
          {[["Cuentas", accounts.length], ["Categorías", categories.length], ["Movimientos", movements.length]].map(([l, v]) => (
            <div key={l} style={{ flex: 1, background: "rgba(255,255,255,.12)", borderRadius: 14, padding: "12px 10px" }}>
              <div style={{ fontSize: 12, opacity: 0.85 }}>{l}</div><div style={{ fontSize: 22, fontWeight: 800 }}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      <Card style={{ padding: 0, overflow: "hidden", marginBottom: 16 }}>
        {rows.map(([ic, title, sub, fn], i, arr) => (
          <div key={title} onClick={fn || undefined} style={{ display: "flex", alignItems: "center", gap: 14, padding: 16, borderBottom: i < arr.length - 1 ? `1px solid ${C.line}` : "none", cursor: fn ? "pointer" : "default" }}>
            <span style={{ width: 40, height: 40, borderRadius: 12, background: C.card2, display: "grid", placeItems: "center", fontSize: 18 }}>{ic}</span>
            <div style={{ flex: 1 }}><div style={{ fontWeight: 700 }}>{title}</div><div style={{ color: C.sub, fontSize: 13 }}>{sub}</div></div>
            {fn && <span style={{ color: C.faint }}>›</span>}
          </div>
        ))}
      </Card>

      <button
        onClick={() => supabase.auth.signOut()}
        style={{
          width: "100%", background: C.redSoft, color: C.red, border: `1px solid ${C.red}`,
          borderRadius: 14, padding: "14px 16px", fontWeight: 700, fontSize: 14, cursor: "pointer",
        }}
      >
        Cerrar sesión
      </button>
    </div>
  );
}
