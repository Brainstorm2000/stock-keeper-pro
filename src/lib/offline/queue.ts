import { get, set, createStore } from "idb-keyval";

export type QueueOp = "insert" | "update" | "delete" | "upsert";

export interface QueuedFilter {
  method: string;
  args: unknown[];
}

export interface QueuedMutation {
  id: string;
  table: string;
  op: QueueOp;
  values?: unknown;
  filters: QueuedFilter[];
  createdAt: string;
  status: "pending" | "failed";
  attempts: number;
  error?: string;
}

const store = createStore("stockflow-offline", "kv");
const KEY = "mutation-queue";

let cache: QueuedMutation[] | null = null;
const listeners = new Set<(items: QueuedMutation[]) => void>();

async function load(): Promise<QueuedMutation[]> {
  if (cache) return cache;
  try {
    cache = ((await get<QueuedMutation[]>(KEY, store)) as QueuedMutation[]) || [];
  } catch {
    cache = [];
  }
  return cache;
}

async function persist(items: QueuedMutation[]) {
  cache = items;
  try {
    await set(KEY, items, store);
  } catch {
    /* storage unavailable */
  }
  listeners.forEach((fn) => fn(items));
}

export function subscribeQueue(fn: (items: QueuedMutation[]) => void) {
  listeners.add(fn);
  void load().then((items) => fn(items));
  return () => listeners.delete(fn);
}

export async function getQueue(): Promise<QueuedMutation[]> {
  return [...(await load())];
}

export async function enqueue(
  item: Omit<QueuedMutation, "id" | "createdAt" | "status" | "attempts">,
): Promise<QueuedMutation> {
  const items = await load();
  const record: QueuedMutation = {
    ...item,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    status: "pending",
    attempts: 0,
  };
  await persist([...items, record]);
  return record;
}

export async function updateItem(id: string, patch: Partial<QueuedMutation>) {
  const items = await load();
  await persist(items.map((i) => (i.id === id ? { ...i, ...patch } : i)));
}

export async function removeItem(id: string) {
  const items = await load();
  await persist(items.filter((i) => i.id !== id));
}

export async function clearFailed() {
  const items = await load();
  await persist(items.filter((i) => i.status !== "failed"));
}

export async function retryItem(id: string) {
  await updateItem(id, { status: "pending", error: undefined });
}