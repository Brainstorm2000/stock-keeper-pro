import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  subscribeQueue,
  clearFailed,
  removeItem,
  retryItem,
  type QueuedMutation,
} from "@/lib/offline/queue";
import { startSyncWatcher, subscribeSyncState, syncQueue } from "@/lib/offline/sync";

export function useOfflineQueue() {
  const [items, setItems] = useState<QueuedMutation[]>([]);
  const [syncing, setSyncing] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    const unsub = subscribeQueue(setItems);
    return () => {
      unsub();
    };
  }, []);
  useEffect(() => {
    const unsub = subscribeSyncState((s) => setSyncing(s.syncing));
    return () => {
      unsub();
    };
  }, []);

  useEffect(() => {
    return startSyncWatcher(({ synced, failed }) => {
      void queryClient.invalidateQueries();
      if (synced) toast.success(`${synced} offline change${synced > 1 ? "s" : ""} synced`);
      if (failed)
        toast.error(`${failed} change${failed > 1 ? "s" : ""} could not sync — review sync issues`);
    });
  }, [queryClient]);

  return {
    items,
    pending: items.filter((i) => i.status === "pending"),
    failed: items.filter((i) => i.status === "failed"),
    syncing,
    syncNow: async () => {
      const r = await syncQueue();
      void queryClient.invalidateQueries();
      return r;
    },
    retry: async (id: string) => {
      await retryItem(id);
      await syncQueue();
      void queryClient.invalidateQueries();
    },
    discard: removeItem,
    discardAllFailed: clearFailed,
  };
}