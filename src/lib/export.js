import * as XLSX from "xlsx";
import { keyToLabel } from "./theme";

/* Export de respaldo. El usuario guarda el archivo donde quiera (Drive,
   OneDrive, pendrive). No parseamos archivos externos — solo escribimos. */

const KIND_LABEL = {
  gasto: "Gasto",
  ingreso: "Ingreso",
  transferencia: "Transferencia",
  cuotaTC: "Cuota TC",
  pagoTarjeta: "Pago tarjeta",
  pagoCredito: "Pago crédito",
  pagoLinea: "Pago línea",
};

// salida de dinero real desde la cuenta origen → monto negativo en el respaldo
const OUTFLOW = new Set(["gasto", "cuotaTC", "pagoTarjeta", "pagoCredito", "pagoLinea"]);

function movementRows({ accounts, categories, movements }) {
  const accName = (id) => accounts.find((a) => a.id === id)?.name || "";
  const catName = (id) => categories.find((c) => c.id === id)?.name || "";
  return movements.map((m) => {
    const cuenta = m.kind === "transferencia"
      ? `${accName(m.fromId)} → ${accName(m.toId)}`
      : accName(m.accountId || m.fromId || m.cardId || m.creditId || m.bankId);
    const detalle = m.kind === "cuotaTC"
      ? `${m.merchant || "Compra"} (cuota ${m.cuotaIndex}/${m.cuotasTotal})`
      : (m.merchant || "");
    const signo = OUTFLOW.has(m.kind) ? -1 : 1;
    return {
      Fecha: m.ts ? new Date(m.ts).toLocaleDateString("es-CL") : "",
      Tipo: KIND_LABEL[m.kind] || m.kind,
      "Comercio/Detalle": detalle,
      Categoria: catName(m.categoryId),
      Cuenta: cuenta,
      Monto: signo * (m.amount || 0),
      Estado: m.status || "",
      Mes: keyToLabel(m.month || ""),
      Nota: (m.note || "").replace(/[\n\r]/g, " "),
    };
  });
}

function accountRows({ accounts, engine }) {
  return accounts.map((a) => ({
    Nombre: a.name,
    Tipo: a.type,
    Saldo: engine?.bal?.[a.id] ?? "",
    "Por facturar (TC)": engine?.cardUsed?.[a.id] ?? "",
    "Deuda (crédito)": engine?.debt?.[a.id] ?? "",
    "Línea usada": engine?.lineUsed?.[a.id] ?? "",
    Cupo: a.cupo || "",
    Línea: a.line || "",
  }));
}

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const today = () => new Date().toISOString().slice(0, 10);

// CSV con BOM UTF-8 para que Excel abra bien las tildes.
export function exportCSV(data) {
  const rows = movementRows(data);
  const headers = ["Fecha", "Tipo", "Comercio/Detalle", "Categoria", "Cuenta", "Monto", "Estado", "Mes", "Nota"];
  const escape = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [headers.map(escape).join(",")];
  rows.forEach((r) => lines.push(headers.map((h) => escape(r[h])).join(",")));
  const csv = "﻿" + lines.join("\r\n");
  download(new Blob([csv], { type: "text/csv;charset=utf-8;" }), `micuadra_movimientos_${today()}.csv`);
}

// XLSX con dos hojas: Movimientos y Cuentas.
export function exportXLSX(data) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(movementRows(data)), "Movimientos");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(accountRows(data)), "Cuentas");
  XLSX.writeFile(wb, `micuadra_respaldo_${today()}.xlsx`);
}
