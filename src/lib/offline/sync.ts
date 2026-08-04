import { supabase } from "@/integrations/supabase/client";
import {
  getQueue,
  removeItem,
  updateItem,
  type QueuedMutation,
} from "./queue";
import { isOffline } from "./interceptor";

type SyncListener = (state: { syncing: boolean }) => void;
const listeners = new Set<SyncListener>();
let syncing = false;

export function subscribeSyncState(fn: SyncListener) {
  listeners.add(fn);
  fn({ syncing });
  return () => listeners.delete(fn);
}

function emit() {
  listeners.forEach((fn) => fn({ syncing }));
}

async function replay(item: QueuedMutation) {
  const client = supabase as any;
  let query = client.from(item.table);

  if (item.op === "insert") query = query.insert(item.values);
  else if (item.op === "upsert") query = query.upsert(item.values);
  else if (item.op === "update") query = query.update(item.values);
  else query = query.delete();

  for (const f of item.filters) {
    if (typeof query[f.method] === "function") {
      query = query[f.method](...(f.args as unknown[]));
    }
  }

  const { error } = await query;
  if (error) throw new Error(error.message || "Sync failed");
}

/** Replays every pending mutation in the order it was created. */
export async function syncQueue(): Promise<{ synced: number; failed: number }> {
  if (syncing || isOffline()) return { synced: 0, failed: 0 };
  syncing = true;
  emit();

  let synced = 0;
  let failed = 0;
  try {
    const items = (await getQueue()).filter((i) => i.status === "pending");
    for (const item of items) {
      if (isOffline()) break;
      try {
        await replay(item);
        await removeItem(item.id);
        synced++;
      } catch (e: any) {
        failed++;
        await updateItem(item.id, {
          status: "failed",
          attempts: item.attempts + 1,
          error: e?.message || "Unknown error",
        });
      }
    }
  } finally {
    syncing = false;
    emit();
  }
  return { synced, failed };
}

export function startSyncWatcher(onDone?: (r: { synced: number; failed: number }) => void) {
  const run = async () => {
    const r = await syncQueue();
    if ((r.synced || r.failed) && onDone) onDone(r);
  };
  window.addEventListener("online", run);
  const interval = window.setInterval(run, 30000);
  void run();
  return () => {
    window.removeEventListener("online", run);
    window.clearInterval(interval);
  };
}