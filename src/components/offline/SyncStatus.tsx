import { useState } from "react";
import { CloudOff, RefreshCw, AlertTriangle, Trash2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useOfflineQueue } from "@/hooks/useOfflineQueue";

const OP_LABEL: Record<string, string> = {
  insert: "New",
  upsert: "Saved",
  update: "Edit",
  delete: "Delete",
};

function prettyTable(table: string) {
  return table.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function SyncStatus() {
  const [open, setOpen] = useState(false);
  const { pending, failed, syncing, syncNow, retry, discard, discardAllFailed } =
    useOfflineQueue();

  const total = pending.length + failed.length;
  if (total === 0) return null;

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="gap-2"
        onClick={() => setOpen(true)}
      >
        {failed.length > 0 ? (
          <AlertTriangle className="h-4 w-4 text-destructive" />
        ) : (
          <CloudOff className="h-4 w-4 text-muted-foreground" />
        )}
        <span className="text-xs">
          {syncing ? "Syncing…" : `${total} unsynced`}
        </span>
        {failed.length > 0 && (
          <Badge variant="destructive" className="h-4 px-1 text-[10px]">
            {failed.length}
          </Badge>
        )}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Offline changes</DialogTitle>
            <DialogDescription>
              Changes made without internet are saved on this device and sent to the
              server automatically once you are back online.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => void syncNow()} disabled={syncing}>
              <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
              Sync now
            </Button>
            {failed.length > 0 && (
              <Button size="sm" variant="outline" onClick={() => void discardAllFailed()}>
                <Trash2 className="mr-2 h-4 w-4" />
                Discard all failed
              </Button>
            )}
          </div>

          <ScrollArea className="max-h-[50vh] pr-2">
            <div className="space-y-2">
              {pending.map((i) => (
                <div key={i.id} className="rounded-md border p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">
                      {OP_LABEL[i.op]} · {prettyTable(i.table)}
                    </span>
                    <Badge variant="secondary" className="gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Waiting
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(i.createdAt).toLocaleString("en-NG")}
                  </p>
                </div>
              ))}

              {failed.map((i) => (
                <div key={i.id} className="rounded-md border border-destructive/40 p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">
                      {OP_LABEL[i.op]} · {prettyTable(i.table)}
                    </span>
                    <Badge variant="destructive">Needs review</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {new Date(i.createdAt).toLocaleString("en-NG")}
                  </p>
                  {i.error && (
                    <p className="mt-1 text-xs text-destructive break-words">{i.error}</p>
                  )}
                  <div className="mt-2 flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => void retry(i.id)}>
                      Retry
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => void discard(i.id)}>
                      Discard
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  );
}