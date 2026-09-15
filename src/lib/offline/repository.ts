import { localDb, type LocalRecord } from "./db";

type LocalTable<T> = {
  bulkPut: (rows: LocalRecord<T>[]) => Promise<unknown>;
  toArray: () => Promise<LocalRecord<T>[]>;
  get: (id: string) => Promise<LocalRecord<T> | undefined>;
  put: (row: LocalRecord<T>) => Promise<unknown>;
};

type Timestamped = { id: string; updated_at?: string | null };

export async function cacheRows<T extends Timestamped>(table: LocalTable<T>, rows: T[]) {
  const existing = await table.toArray();
  const pending = new Map(existing.filter((row) => !row.isSynced).map((row) => [row.id, row]));
  await table.bulkPut(rows.map((data) => pending.get(data.id) ?? toSyncedRecord(data)));
}

export async function readRows<T>(table: LocalTable<T>) {
  return (await table.toArray()).filter((row) => !row.deletedAt).map((row) => row.data);
}

export async function saveLocal<T extends Timestamped>(table: LocalTable<T>, data: T) {
  const now = new Date().toISOString();
  const next = { ...data, updated_at: now } as T;
  await table.put({ id: data.id, data: next, isSynced: false, updatedAt: now });
  return next;
}

export async function removeLocal<T>(table: LocalTable<T>, id: string) {
  const existing = await table.get(id);
  if (!existing) return;
  const now = new Date().toISOString();
  await table.put({ ...existing, isSynced: false, updatedAt: now, deletedAt: now });
}

export function toSyncedRecord<T extends Timestamped>(data: T): LocalRecord<T> {
  return {
    id: data.id,
    data,
    isSynced: true,
    updatedAt: data.updated_at ?? new Date().toISOString(),
  };
}

export async function readLocalFirst<T extends Timestamped>(
  table: LocalTable<T>,
  fetchRemote: () => Promise<T[]>,
  matches: (row: T) => boolean,
) {
  const local = (await readRows(table)).filter(matches);
  if (typeof navigator !== "undefined" && !navigator.onLine) return local;
  try {
    const remote = await fetchRemote();
    await cacheRows(table, remote);
    return remote.filter(matches);
  } catch (error) {
    if (local.length) return local;
    throw error;
  }
}

export const productsTable = localDb.products;
export const customersTable = localDb.customers;