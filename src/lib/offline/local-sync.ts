import { supabase } from "@/integrations/supabase/client";
import { localDb, type LocalRecord } from "./db";

type SyncTable = "products" | "sales" | "sale_items" | "stock_history";
type SyncableTable = {
  toArray: () => Promise<LocalRecord<Record<string, unknown>>[]>;
  bulkPut: (rows: LocalRecord<Record<string, unknown>>[]) => Promise<unknown>;
};

const syncTables: Record<SyncTable, SyncableTable> = {
  products: localDb.products as unknown as SyncableTable,
  sales: localDb.sales as unknown as SyncableTable,
  sale_items: localDb.saleItems as unknown as SyncableTable,
  stock_history: localDb.stockHistory as unknown as SyncableTable,
};
const syncingSaleIds = new Set<string>();

function timestampColumn(name: SyncTable) {
  return name === "sale_items" || name === "stock_history" ? "created_at" : "updated_at";
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
    delete row.sub_units;
    delete row.branches;
    delete row.suppliers;
    delete row.brands;
    delete row.product_categories;
    delete row.variations;
  }
  if (name === "sales") delete row.sale_items;
  if (name === "sale_items") delete row.product_name;
  return row;
}

async function syncRows(name: SyncTable, ids: Set<string>) {
  if (ids.size === 0 || typeof navigator !== "undefined" && !navigator.onLine) return 0;

  const table = syncTables[name];
  const pending = (await table.toArray())
    .filter((row) => ids.has(row.id) && !row.isSynced && !row.deletedAt)
    .map((row) => ({ ...row, syncBlocked: false, syncError: undefined }));
  const resolved: LocalRecord<Record<string, unknown>>[] = [];

  for (const row of pending) {
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

      const { error } = await supabase
        .from(name)
        .upsert(toSupabaseRow(name, row.data), { onConflict: "id" });
      if (error) throw error;
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

export async function syncLocalPosSale(saleId: string) {
  if (syncingSaleIds.has(saleId)) return 0;
  syncingSaleIds.add(saleId);

  try {
  if (typeof navigator !== "undefined" && !navigator.onLine) return 0;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return 0;

  const saleRecord = await localDb.sales.get(saleId);
  if (!saleRecord) return 0;

  const saleItems = (await localDb.saleItems.toArray())
    .filter((row) => !row.deletedAt && row.data.sale_id === saleId);
  const saleItemIds = new Set(saleItems.map((row) => row.id));
  const productIds = new Set(saleItems.map((row) => row.data.product_id).filter(Boolean));
  const productRecords = await localDb.products.toArray();
  const stockManagedProductIds = new Set(productRecords
    .filter((row) => productIds.has(row.id) && row.data.item_type === "product")
    .map((row) => row.id));
  const historyIds = new Set((await localDb.stockHistory.toArray())
    .filter((row) => !row.deletedAt && row.data.notes === `Sale: ${saleRecord.data.sale_number}`)
    .map((row) => row.id));

  let synced = 0;
  synced += await syncRows("products", stockManagedProductIds);
  synced += await syncRows("sales", new Set([saleId]));
  synced += await syncRows("sale_items", saleItemIds);
  synced += await syncRows("stock_history", historyIds);
  return synced;
  } finally {
    syncingSaleIds.delete(saleId);
  }
}

export async function syncPendingLocalPosSales(excludedSaleIds: ReadonlySet<string> = new Set()) {
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  const sales = await localDb.sales.toArray();
  const saleItems = await localDb.saleItems.toArray();
  const stockHistory = await localDb.stockHistory.toArray();
  const salesByNumber = new Map(sales.map((row) => [row.data.sale_number, row.id]));
  const pendingSaleIds = new Set([
    ...sales.filter((row) => !row.isSynced).map((row) => row.id),
    ...saleItems.filter((row) => !row.isSynced && !row.deletedAt).map((row) => row.data.sale_id),
    ...stockHistory
      .filter((row) => !row.isSynced && !row.deletedAt && typeof row.data.notes === "string")
      .map((row) => salesByNumber.get(String(row.data.notes).replace(/^Sale: /, "")))
      .filter((id): id is string => Boolean(id)),
  ]);

  for (const saleId of pendingSaleIds) {
    if (excludedSaleIds.has(saleId)) continue;
    try {
      await syncLocalPosSale(saleId);
    } catch (error) {
      console.error("POS sale sync failed", error);
    }
  }
}