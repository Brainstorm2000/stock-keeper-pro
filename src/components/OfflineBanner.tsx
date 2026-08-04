import { useEffect, useState } from "react";
import { WifiOff, AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Non-blocking banner shown at the top of the app when the browser reports
 * no internet or a very slow connection. Auto-dismisses when back online.
 */
export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(
    typeof navigator !== "undefined" ? !navigator.onLine : false,
  );
  const [isSlow, setIsSlow] = useState(false);
  const [justRecovered, setJustRecovered] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const goOffline = () => {
      setIsOffline(true);
      setJustRecovered(false);
      setDismissed(false);
    };
    const goOnline = () => {
      setIsOffline(false);
      setJustRecovered(true);
      setDismissed(false);
      setTimeout(() => setJustRecovered(false), 2500);
    };
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);

    // Optional slow-connection detection via Network Information API
    const conn: any =
      (navigator as any).connection ||
      (navigator as any).mozConnection ||
      (navigator as any).webkitConnection;
    const checkSpeed = () => {
      if (!conn) return;
      const slowTypes = ["slow-2g", "2g"];
      const slow =
        slowTypes.includes(conn.effectiveType) ||
        (typeof conn.downlink === "number" && conn.downlink > 0 && conn.downlink < 0.3);
      setIsSlow(slow);
      if (slow) setDismissed(false);
    };
    checkSpeed();
    conn?.addEventListener?.("change", checkSpeed);

    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
      conn?.removeEventListener?.("change", checkSpeed);
    };
  }, []);

  if (!isOffline && !isSlow && !justRecovered) return null;
  if (dismissed) return null;

  const variant = isOffline
    ? "offline"
    : justRecovered
      ? "recovered"
      : "slow";

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "fixed top-0 inset-x-0 z-[100] flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium shadow-md transition-colors",
        variant === "offline" &&
          "bg-destructive text-destructive-foreground",
        variant === "slow" &&
          "bg-yellow-500 text-black dark:bg-yellow-600 dark:text-white",
        variant === "recovered" && "bg-emerald-600 text-white",
      )}
    >
      {variant === "offline" && (
        <>
          <WifiOff className="h-4 w-4 shrink-0" />
          <span>
            You are offline. Changes may fail to save until your connection is
            restored.
          </span>
        </>
      )}
      {variant === "slow" && (
        <>
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            Your internet connection is slow. Some actions may take longer than
            usual.
          </span>
        </>
      )}
      {variant === "recovered" && <span>Back online</span>}
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => setDismissed(true)}
        className="ml-2 p-1 rounded hover:bg-black/10 focus:outline-none focus:ring-2 focus:ring-white/50 transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}