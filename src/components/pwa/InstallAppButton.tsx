import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import { useEffect, useState } from "react";

export function InstallAppButton() {
  const { canInstall, isInstalled, install } = useInstallPrompt();
  const [isDismissed, setIsDismissed] = useState(() => localStorage.getItem("stoqkip-install-dismissed") === "true");

  useEffect(() => {
    if (canInstall) setIsDismissed(false);
  }, [canInstall]);

  if (isInstalled || isDismissed || !canInstall) return null;

  const handleInstall = async () => {
    await install();
  };

  const dismiss = () => {
    localStorage.setItem("stoqkip-install-dismissed", "true");
    setIsDismissed(true);
  };

  return (
    <>
      <div className="fixed bottom-4 right-4 z-[60] flex items-center gap-1 rounded-lg border bg-background p-1.5 shadow-lg sm:bottom-6 sm:right-6">
        <Button variant="default" size="sm" onClick={handleInstall} aria-label="Install StoqKip">
          <Download className="h-4 w-4" />
          <span>Install app</span>
        </Button>
        <Button variant="ghost" size="icon" onClick={dismiss} aria-label="Dismiss install prompt" title="Dismiss">
          <X className="h-4 w-4" />
        </Button>
      </div>
    </>
  );
}