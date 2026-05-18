import { useState } from "react";
import { jsPDF } from "jspdf";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileDown, Loader2, Palette } from "lucide-react";
import { useStaff, type Staff } from "@/hooks/useStaff";
import { useOrganization, type Organization } from "@/hooks/useOrganization";
import { QRCodeSVG } from "qrcode.react";
import { createRoot } from "react-dom/client";

interface StaffIDCardExportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  singleStaff?: Staff;
}

interface CardConfig {
  themeColor: string;
  showEmail: boolean;
  showPhone: boolean;
  showDepartment: boolean;
  showStaffId: boolean;
  showBranch: boolean;
  showEmploymentDate: boolean;
  showQR: boolean;
}

const DEFAULT_CONFIG: CardConfig = {
  themeColor: "#0d9488",
  showEmail: true,
  showPhone: true,
  showDepartment: true,
  showStaffId: true,
  showBranch: true,
  showEmploymentDate: true,
  showQR: true,
};

async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function renderQRToDataURL(value: string, size: number): Promise<string> {
  return new Promise((resolve) => {
    const tempDiv = document.createElement("div");
    tempDiv.style.cssText = "position:absolute;left:-9999px";
    document.body.appendChild(tempDiv);
    const root = createRoot(tempDiv);
    root.render(
      <QRCodeSVG value={value} size={size} level="M" includeMargin />,
    );
    setTimeout(() => {
      const svg = tempDiv.querySelector("svg");
      if (svg) {
        const data = new XMLSerializer().serializeToString(svg);
        const img = new Image();
        img.onload = () => {
          const c = document.createElement("canvas");
          c.width = size;
          c.height = size;
          c.getContext("2d")!.drawImage(img, 0, 0, size, size);
          root.unmount();
          document.body.removeChild(tempDiv);
          resolve(c.toDataURL("image/png"));
        };
        img.src =
          "data:image/svg+xml;base64," +
          btoa(unescape(encodeURIComponent(data)));
      } else {
        root.unmount();
        document.body.removeChild(tempDiv);
        resolve("");
      }
    }, 150);
  });
}

async function renderFront(
  staff: Staff,
  org: Organization | null,
  config: CardConfig,
): Promise<HTMLCanvasElement> {
  const w = 1012,
    h = 638;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const primary = config.themeColor;

  // Background
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, 24);
  ctx.fill();

  // Left accent stripe
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, 24);
  ctx.clip();
  ctx.fillStyle = primary;
  ctx.fillRect(0, 0, 28, h);
  ctx.restore();

  const padX = 70;

  // Header
  ctx.fillStyle = "#0f172a";
  ctx.font = "900 34px system-ui";
  ctx.fillText((org?.name || "Organization").toUpperCase(), padX, 70);

  ctx.fillStyle = "#64748b";
  ctx.font = "bold 16px system-ui";
  ctx.fillText("EMPLOYEE  ·  IDENTIFICATION  CARD", padX, 96);

  // Photo
  const photoX = padX,
    photoY = 165,
    photoSize = 240;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(photoX, photoY, photoSize, photoSize, 12);
  ctx.clip();
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(photoX, photoY, photoSize, photoSize);

  let photoLoaded = false;
  if (staff.photo_url) {
    try {
      const img = await loadImage(staff.photo_url);
      const iw = img.naturalWidth || img.width;
      const ih = img.naturalHeight || img.height;
      const scale = Math.max(photoSize / iw, photoSize / ih);
      const dw = iw * scale,
        dh = ih * scale;
      ctx.drawImage(
        img,
        photoX + (photoSize - dw) / 2,
        photoY + (photoSize - dh) / 2,
        dw,
        dh,
      );
      photoLoaded = true;
    } catch {
      photoLoaded = false;
    }
  }
  if (!photoLoaded) {
    const initials = staff.full_name
      .split(" ")
      .map((n) => n.charAt(0).toUpperCase())
      .slice(0, 2)
      .join("");
    ctx.fillStyle = primary;
    ctx.font = "900 96px system-ui";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(initials, photoX + photoSize / 2, photoY + photoSize / 2);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }
  ctx.restore();

  // Name & Role
  const infoX = photoX + photoSize + 50;
  ctx.fillStyle = "#0f172a";
  ctx.font = "900 44px system-ui";
  ctx.fillText(staff.full_name, infoX, 210);

  if (staff.role) {
    ctx.fillStyle = primary;
    ctx.font = "800 24px system-ui";
    ctx.fillText(staff.role, infoX, 245);
  }

  // Details
  const details: [string, string][] = [];
  if (config.showStaffId && staff.staff_id)
    details.push(["ID NO.", staff.staff_id]);
  if (config.showDepartment && staff.department)
    details.push(["DEPARTMENT", staff.department]);
  if (config.showPhone && staff.phone) details.push(["PHONE", staff.phone]);
  if (config.showEmail && staff.email) details.push(["EMAIL", staff.email]);

  let dy = 300;
  for (const [label, value] of details) {
    ctx.fillStyle = "#64748b";
    ctx.font = "900 13px system-ui";
    ctx.fillText(label, infoX, dy);
    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 20px system-ui";
    ctx.fillText(value, infoX, dy + 24);
    dy += 55;
  }

  // Thin outer border
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(0.5, 0.5, w - 1, h - 1, 24);
  ctx.stroke();

  return canvas;
}

async function renderBack(
  staff: Staff,
  org: Organization | null,
  config: CardConfig,
): Promise<HTMLCanvasElement> {
  const w = 1012,
    h = 638;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  const primary = config.themeColor;

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, 24);
  ctx.fill();

  const padX = 50;
  ctx.fillStyle = "#475569";
  ctx.font = "900 15px system-ui";
  ctx.fillText("TERMS & CONDITIONS", padX, 60);

  const terms = [
    `This card is property of ${org?.name || "the organization"}.`,
    "Must be worn visibly during work hours.",
    "Report loss immediately to HR department.",
    "Not transferable to another person.",
  ];
  ctx.fillStyle = "#1e293b";
  ctx.font = "bold 18px system-ui";
  terms.forEach((t, i) => ctx.fillText("•  " + t, padX, 115 + i * 35));

  if (config.showQR) {
    const qrValue = JSON.stringify({
      staff_id: staff.id,
      organization_id: staff.organization_id,
    });
    const qrDataUrl = await renderQRToDataURL(qrValue, 512);
    if (qrDataUrl) {
      const qrImg = await loadImage(qrDataUrl);
      const qrSize = 230,
        qrX = w - qrSize - 60,
        qrY = 110;
      ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
      ctx.fillStyle = "#475569";
      ctx.font = "900 13px system-ui";
      ctx.textAlign = "center";
      ctx.fillText("SCAN FOR ATTENDANCE", qrX + qrSize / 2, qrY + qrSize + 35);
      ctx.textAlign = "left";
    }
  }

  ctx.fillStyle = primary;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(0, 0, w, h, 24);
  ctx.clip();
  ctx.fillRect(0, h - 18, w, 18);
  ctx.restore();

  // Thin outer border
  ctx.strokeStyle = "#cbd5e1";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect(0.5, 0.5, w - 1, h - 1, 24);
  ctx.stroke();

  return canvas;
}

export function StaffIDCardExport({
  open,
  onOpenChange,
  singleStaff,
}: StaffIDCardExportProps) {
  const { data: allStaff = [] } = useStaff();
  const { data: organization } = useOrganization();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    singleStaff ? new Set([singleStaff.id]) : new Set(),
  );
  const [exporting, setExporting] = useState(false);
  const [config, setConfig] = useState<CardConfig>(DEFAULT_CONFIG);
  const activeStaff = allStaff.filter((s) => s.is_active);

  const toggleId = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () =>
    setSelectedIds(
      selectedIds.size === activeStaff.length
        ? new Set()
        : new Set(activeStaff.map((s) => s.id)),
    );

  const exportPDF = async () => {
    setExporting(true);
    try {
      const selected = activeStaff.filter((s) => selectedIds.has(s.id));
      const org = organization ?? null;
      const cardW = 85.6,
        cardH = 54,
        marginX = 12,
        marginY = 12,
        gapX = 6,
        gapY = 6;
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const cardImages: string[] = [];
      for (const staff of selected) {
        cardImages.push(
          (await renderFront(staff, org, config)).toDataURL("image/png"),
        );
        cardImages.push(
          (await renderBack(staff, org, config)).toDataURL("image/png"),
        );
      }

      cardImages.forEach((img, i) => {
        if (i > 0 && i % 8 === 0) pdf.addPage();
        const pos = i % 8;
        const col = pos % 2;
        const row = Math.floor(pos / 2);
        pdf.addImage(
          img,
          "PNG",
          marginX + col * (cardW + gapX),
          marginY + row * (cardH + gapY),
          cardW,
          cardH,
        );
      });

      pdf.save(`ID-Cards-${new Date().toISOString().split("T")[0]}.pdf`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-900 text-xl uppercase tracking-tight">
            Export Staff ID Cards
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="font-bold">Theme Color</Label>
            <div className="flex gap-2">
              <Input
                type="color"
                value={config.themeColor}
                onChange={(e) =>
                  setConfig((prev) => ({ ...prev, themeColor: e.target.value }))
                }
                className="w-12 h-8 p-0 cursor-pointer"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="font-bold">Card Details Visibility</Label>
            <div className="grid grid-cols-2 gap-3 p-3 bg-muted/50 rounded-xl">
              {(
                [
                  ["showStaffId", "Staff ID"],
                  ["showDepartment", "Department"],
                  ["showPhone", "Phone"],
                  ["showEmail", "Email"],
                  ["showQR", "QR Code"],
                ] as [keyof CardConfig, string][]
              ).map(([key, label]) => (
                <label
                  key={key}
                  className="flex items-center gap-2 text-sm font-bold cursor-pointer"
                >
                  <Checkbox
                    checked={config[key] as boolean}
                    onCheckedChange={(v) =>
                      setConfig((prev) => ({ ...prev, [key]: !!v }))
                    }
                  />{" "}
                  {label}
                </label>
              ))}
            </div>
          </div>
          {!singleStaff && (
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label className="font-bold">
                  {selectedIds.size} of {activeStaff.length} selected
                </Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={selectAll}
                  className="font-bold text-[#FF9E3D]"
                >
                  {" "}
                  {selectedIds.size === activeStaff.length
                    ? "Deselect All"
                    : "Select All"}
                </Button>
              </div>
              <ScrollArea className="h-[180px] border rounded-xl p-2 bg-background">
                {activeStaff.map((s) => (
                  <label
                    key={s.id}
                    className="flex items-center gap-2 py-2 px-3 hover:bg-muted rounded-lg cursor-pointer"
                  >
                    <Checkbox
                      checked={selectedIds.has(s.id)}
                      onCheckedChange={() => toggleId(s.id)}
                    />
                    <span className="text-sm font-bold">{s.full_name}</span>
                  </label>
                ))}
              </ScrollArea>
            </div>
          )}
          <Button
            onClick={exportPDF}
            disabled={selectedIds.size === 0 || exporting}
            className="w-full h-12 rounded-xl font-black text-md"
          >
            {exporting ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <FileDown className="mr-2 h-5 w-5" />
            )}
            {exporting
              ? "GENERATING PDF..."
              : `EXPORT ${selectedIds.size} ID CARD${selectedIds.size !== 1 ? "S" : ""}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
