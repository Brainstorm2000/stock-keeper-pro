import { supabase } from "@/integrations/supabase/client";
import { enqueue, type QueueOp, type QueuedFilter } from "./queue";

/**
 * Patches `supabase.from(...)` so that write operations performed while the
 * browser is offline are stored in a local queue and replayed once the
 * connection is back. Reads are left untouched (React Query serves them from
 * the persisted cache while offline).
 */

const FILTER_METHODS = [
  "eq", "neq", "gt", "gte", "lt", "lte", "like", "ilike", "is", "in",
  "contains", "containedBy", "match", "not", "or", "filter", "range",
  "order", "limit", "returns", "abortSignal", "csv", "geojson", "explain",
];

const PASSTHROUGH_CHAIN = ["select", "single", "maybeSingle", "throwOnError"];

export function isOffline() {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

function withIds(values: unknown): unknown {
  const stamp = (row: any) =>
    row && typeof row === "object" && !row.id
      ? { ...row, id: crypto.randomUUID() }
      : row;
  return Array.isArray(values) ? values.map(stamp) : stamp(values);
}

function makeOfflineBuilder(table: string, op: QueueOp, rawValues?: unknown) {
  const filters: QueuedFilter[] = [];
  const values = op === "delete" ? undefined : withIds(rawValues);
  let wantsSingle = false;

  const result = () => {
    const data =
      op === "delete"
        ? null
        : wantsSingle
          ? Array.isArray(values)
            ? (values as unknown[])[0]
            : values
          : Array.isArray(values)
            ? values
            : values
              ? [values]
              : null;
    return { data, error: null, count: null, status: 200, statusText: "Queued offline" };
  };

  const builder: any = {
    then(onFulfilled: (v: any) => unknown, onRejected?: (e: unknown) => unknown) {
      return enqueue({ table, op, values, filters })
        .then(() => onFulfilled(result()))
        .catch((e) => (onRejected ? onRejected(e) : Promise.reject(e)));
    },
    catch(onRejected: (e: unknown) => unknown) {
      return builder.then((v: unknown) => v, onRejected);
    },
    finally(onFinally: () => void) {
      return builder.then(
        (v: unknown) => {
          onFinally();
          return v;
        },
        (e: unknown) => {
          onFinally();
          throw e;
        },
      );
    },
  };

  for (const m of FILTER_METHODS) {
    builder[m] = (...args: unknown[]) => {
      filters.push({ method: m, args });
      return builder;
    };
  }
  for (const m of PASSTHROUGH_CHAIN) {
    builder[m] = (..._args: unknown[]) => {
      if (m === "single" || m === "maybeSingle") wantsSingle = true;
      return builder;
    };
  }

  return builder;
}

let installed = false;

export function installOfflineInterceptor() {
  if (installed) return;
  installed = true;

  const client = supabase as any;
  const originalFrom = client.from.bind(client);

  client.from = (table: string) => {
    const real = originalFrom(table);
    if (!isOffline()) return real;

    return new Proxy(real, {
      get(target, prop, receiver) {
        if (prop === "insert" || prop === "update" || prop === "delete" || prop === "upsert") {
          return (values?: unknown) =>
            makeOfflineBuilder(table, prop as QueueOp, values);
        }
        return Reflect.get(target, prop, receiver);
      },
    });
  };
}