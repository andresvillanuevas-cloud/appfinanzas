import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";
import { uid } from "../engine/engine";

/* ============================================================
   Hooks de datos contra Supabase, con estado local optimista:
   - el cambio se aplica al estado local de inmediato,
   - se persiste en Supabase,
   - si falla, se revierte y se notifica.

   La DB usa snake_case; el motor y la UI usan camelCase
   (mismas formas que el prototipo cuadra.jsx).
   ============================================================ */

// ---------- mapeo accounts ----------
const accountFromRow = (r) => ({
  id: r.id,
  name: r.name,
  type: r.type,
  color: r.color,
  initial: Number(r.initial) || 0,
  line: Number(r.line) || 0,
  cupo: Number(r.cupo) || 0,
  cierre: r.cierre,
  venc: r.venc,
  cuotaValue: r.cuota_value == null ? 0 : Number(r.cuota_value),
  cuotasRestantes: r.cuotas_restantes == null ? 0 : Number(r.cuotas_restantes),
  pagoDia: r.pago_dia,
  vencMonth: r.venc_month,
});

const accountToRow = (a, userId) => ({
  id: a.id,
  user_id: userId,
  name: a.name,
  type: a.type,
  color: a.color,
  initial: a.initial || 0,
  line: a.line || 0,
  cupo: a.cupo || 0,
  cierre: a.cierre || null,
  venc: a.venc || null,
  cuota_value: a.cuotaValue || null,
  cuotas_restantes: a.cuotasRestantes || null,
  pago_dia: a.pagoDia || null,
  venc_month: a.vencMonth || null,
});

// ---------- mapeo movements ----------
const movementFromRow = (r) => ({
  id: r.id,
  kind: r.kind,
  amount: Number(r.amount) || 0,
  month: r.month,
  status: r.status,
  merchant: r.merchant,
  note: r.note,
  accountId: r.account_id,
  fromId: r.from_id,
  toId: r.to_id,
  cardId: r.card_id,
  creditId: r.credit_id,
  bankId: r.bank_id,
  categoryId: r.category_id,
  cuotaIndex: r.cuota_index,
  cuotasTotal: r.cuotas_total,
  purchaseGroup: r.purchase_group,
  ts: r.ts ? new Date(r.ts).getTime() : Date.now(),
});

const movementToRow = (m, userId) => ({
  id: m.id,
  user_id: userId,
  kind: m.kind,
  amount: m.amount,
  month: m.month,
  status: m.status || "confirmado",
  merchant: m.merchant || null,
  note: m.note || null,
  account_id: m.accountId || null,
  from_id: m.fromId || null,
  to_id: m.toId || null,
  card_id: m.cardId || null,
  credit_id: m.creditId || null,
  bank_id: m.bankId || null,
  category_id: m.categoryId || null,
  cuota_index: m.cuotaIndex ?? null,
  cuotas_total: m.cuotasTotal ?? null,
  purchase_group: m.purchaseGroup || null,
  ts: m.ts ? new Date(m.ts).toISOString() : new Date().toISOString(),
});

// ---------- mapeo categories ----------
const categoryFromRow = (r) => ({
  id: r.id,
  name: r.name,
  type: r.type,
  prioridad: r.prioridad,
  icon: r.icon,
  color: r.color,
});

const categoryToRow = (c, userId) => ({
  id: c.id,
  user_id: userId,
  name: c.name,
  type: c.type,
  prioridad: c.prioridad || null,
  icon: c.icon || null,
  color: c.color || null,
});

// ---------- hook genérico ----------
function useTable({ userId, table, fromRow, toRow, order, notify }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    (async () => {
      let q = supabase.from(table).select("*");
      if (order) q = q.order(order.column, { ascending: order.ascending });
      const { data, error } = await q;
      if (!alive) return;
      if (error) notify?.(`Error cargando ${table}`);
      else setRows((data || []).map(fromRow));
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [userId, table]); // eslint-disable-line react-hooks/exhaustive-deps

  // agrega uno o varios registros de forma optimista; revierte si falla
  const add = useCallback(async (items) => {
    const list = (Array.isArray(items) ? items : [items]).map((x) => ({ ...x, id: x.id || uid() }));
    setRows((p) => [...list, ...p]);
    const { error } = await supabase.from(table).insert(list.map((x) => toRow(x, userId)));
    if (error) {
      const ids = new Set(list.map((x) => x.id));
      setRows((p) => p.filter((r) => !ids.has(r.id)));
      notify?.("No se pudo guardar — revisa tu conexión");
      return null;
    }
    return Array.isArray(items) ? list : list[0];
  }, [table, userId, notify]); // eslint-disable-line react-hooks/exhaustive-deps

  // elimina de forma optimista; revierte si falla
  const remove = useCallback(async (id) => {
    let backup;
    setRows((p) => { backup = p; return p.filter((r) => r.id !== id); });
    const { error } = await supabase.from(table).delete().eq("id", id);
    if (error) {
      setRows(backup);
      notify?.("No se pudo eliminar — revisa tu conexión");
      return false;
    }
    return true;
  }, [table, notify]);

  return { rows, loading, add, remove };
}

// ---------- hooks públicos ----------
export function useAccounts(userId, notify) {
  const t = useTable({
    userId, table: "accounts", fromRow: accountFromRow, toRow: accountToRow,
    order: { column: "created_at", ascending: true }, notify,
  });
  return { accounts: t.rows, loading: t.loading, addAccount: t.add, deleteAccount: t.remove };
}

export function useMovements(userId, notify) {
  const t = useTable({
    userId, table: "movements", fromRow: movementFromRow, toRow: movementToRow,
    order: { column: "ts", ascending: false }, notify,
  });
  return { movements: t.rows, loading: t.loading, addMovements: t.add, deleteMovement: t.remove };
}

export function useCategories(userId, notify) {
  const t = useTable({
    userId, table: "categories", fromRow: categoryFromRow, toRow: categoryToRow,
    order: { column: "name", ascending: true }, notify,
  });
  return { categories: t.rows, loading: t.loading, addCategory: t.add, deleteCategory: t.remove };
}
