import { Download, Share } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import { useState } from "react";

export function InstallAppButton() {
  const { canInstall, isInstalled, isIos, install } = useInstallPrompt();
  const [showIosHelp, setShowIosHelp] = useState(false);

  if (isInstalled || !canInstall) return null;

  const handleInstall = async () => {
    if (isIos) {
      setShowIosHelp(true);
      return;
    }
    await install();
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={handleInstall} aria-label="Install StoqKip">
        <Download className="h-4 w-4" />
        <span className="hidden sm:inline">Install app</span>
      </Button>
      <Dialog open={showIosHelp} onOpenChange={setShowIosHelp}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Install StoqKip</DialogTitle>
            <DialogDescription className="space-y-3 pt-2">
              <span className="block">In Safari, tap the <Share className="inline h-4 w-4 align-text-bottom" /> Share button, then choose <strong>Add to Home Screen</strong>.</span>
              <span className="block">Open StoqKip from your Home Screen for the full app experience.</span>
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </>
  );
}