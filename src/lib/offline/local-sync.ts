import { supabase } from "@/integrations/supabase/client";
import { localDb, type LocalRecord } from "./db";

type SyncTable = "products" | "customers" | "sales" | "sale_items" | "stock_history" | "attendance";
type SyncableTable = {
  toArray: () => Promise<LocalRecord<Record<string, unknown>>[]>;
  bulkPut: (rows: LocalRecord<Record<string, unknown>>[]) => Promise<unknown>;
};

const tables: Array<{ name: SyncTable; table: SyncableTable }> = [
  { name: "products", table: localDb.products as unknown as SyncableTable },
  { name: "customers", table: localDb.customers as unknown as SyncableTable },
  { name: "sales", table: localDb.sales as unknown as SyncableTable },
  { name: "sale_items", table: localDb.saleItems as unknown as SyncableTable },
  { name: "stock_history", table: localDb.stockHistory as unknown as SyncableTable },
  { name: "attendance", table: localDb.attendance as unknown as SyncableTable },
];

function timestampColumn(name: SyncTable) {
  return name === "sale_items" || name === "stock_history" ? "created_at" : "updated_at";
}

function isOffline() {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

function describeError(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const value = error as Record<string, unknown>;
    const parts = [value.message, value.details, value.hint, value.code]
      .filter((part): part is string => typeof part === "string" && part.length > 0);
    if (parts.length) return parts.join(" | ");
  }
  return String(error);
}

function toSupabaseRow(name: SyncTable, data: Record<string, unknown>) {
  const row = { ...data };
  if (name === "products") {
    delete row.units;
    delete row.branches;
    delete row.suppliers;
    delete row.brands;
    delete row.variations;
  }
  if (name === "sales") delete row.sale_items;
  if (name === "sale_items") delete row.product_name;
  if (name === "attendance") {
    delete row.staff;
    delete row.shifts;
    delete row.branches;
    delete row.departments;
  }
  return row;
}

async function syncTable(name: SyncTable, table: SyncableTable) {
  const pending = (await table.toArray()).filter((row) => !row.isSynced && !row.syncBlocked);
  if (!pending.length) return 0;

  const resolved: LocalRecord<Record<string, unknown>>[] = [];

  for (const row of pending) {
    if (isOffline()) break;
    try {
      const timestamp = timestampColumn(name);
      const { data: remote, error: timestampError } = await supabase
        .from(name)
        .select(timestamp)
        .eq("id", row.id)
        .maybeSingle();
      if (timestampError) throw timestampError;
      const remoteUpdatedAt = (remote as Record<string, string> | null)?.[timestamp];

      if (remoteUpdatedAt && remoteUpdatedAt > row.updatedAt) {
        const { data, error } = await supabase.from(name).select("*").eq("id", row.id).single();
        if (error) throw error;
        resolved.push({ id: row.id, data, isSynced: true, updatedAt: remoteUpdatedAt });
        continue;
      }

      if (row.deletedAt) {
        const { error } = await supabase.from(name).delete().eq("id", row.id);
        if (error && error.code !== "PGRST116") throw error;
      } else {
        const { error } = await supabase
          .from(name)
          .upsert(toSupabaseRow(name, row.data), { onConflict: "id" });
        if (error) throw error;
      }
      resolved.push({ ...row, isSynced: true });
    } catch (error) {
      const message = `${name}/${row.id}: ${describeError(error)}`;
      await table.bulkPut([{ ...row, syncError: message, syncBlocked: true }]);
      throw new Error(message);
    }
  }

  if (resolved.length) await table.bulkPut(resolved);
  return resolved.length;
}

export async function syncLocalChanges() {
  if (isOffline()) return 0;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return 0;
  let synced = 0;
  for (const { name, table } of tables) {
    synced += await syncTable(name, table);
  }
  return synced;
}