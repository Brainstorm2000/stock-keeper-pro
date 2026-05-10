import { useState } from 'react';
import { jsPDF } from 'jspdf';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FileDown, Loader2, Palette } from 'lucide-react';
import { useStaff, type Staff } from '@/hooks/useStaff';
import { useOrganization, type Organization } from '@/hooks/useOrganization';
import { QRCodeSVG } from 'qrcode.react';
import { createRoot } from 'react-dom/client';

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
  themeColor: '#0d9488',
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
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function renderQRToDataURL(value: string, size: number): Promise<string> {
  return new Promise((resolve) => {
    const tempDiv = document.createElement('div');
    tempDiv.style.cssText = 'position:absolute;left:-9999px';
    document.body.appendChild(tempDiv);
    const root = createRoot(tempDiv);
    root.render(<QRCodeSVG value={value} size={size} level="M" includeMargin />);
    setTimeout(() => {
      const svg = tempDiv.querySelector('svg');
      if (svg) {
        const data = new XMLSerializer().serializeToString(svg);
        const img = new Image();
        img.onload = () => {
          const c = document.createElement('canvas');
          c.width = size; c.height = size;
          c.getContext('2d')!.drawImage(img, 0, 0, size, size);
          root.unmount();
          document.body.removeChild(tempDiv);
          resolve(c.toDataURL('image/png'));
        };
        img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(data)));
      } else {
        root.unmount();
        document.body.removeChild(tempDiv);
        resolve('');
      }
    }, 150);
  });
}

function hexToRgb(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return { r, g, b };
}

async function renderFront(staff: Staff, org: Organization | null, config: CardConfig): Promise<HTMLCanvasElement> {
  const w = 1012, h = 638;
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const primary = config.themeColor;

  // White card background
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.roundRect(0, 0, w, h, 24); ctx.fill();

  // Left accent stripe
  ctx.save();
  ctx.beginPath(); ctx.roundRect(0, 0, w, h, 24); ctx.clip();
  ctx.fillStyle = primary;
  ctx.fillRect(0, 0, 28, h);
  ctx.restore();

  const padX = 70;

  // Header: org name + logo placeholder area
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 30px system-ui';
  ctx.fillText((org?.name || 'Organization').toUpperCase(), padX, 70);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '14px system-ui';
  ctx.fillText('EMPLOYEE  ·  IDENTIFICATION  CARD', padX, 96);

  // Divider
  ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(padX, 120); ctx.lineTo(w - 50, 120); ctx.stroke();

  // Photo (rounded square)
  const photoX = padX, photoY = 165, photoSize = 240;
  ctx.save();
  ctx.beginPath(); ctx.roundRect(photoX, photoY, photoSize, photoSize, 12); ctx.clip();
  ctx.fillStyle = '#f1f5f9'; ctx.fillRect(photoX, photoY, photoSize, photoSize);

  let photoLoaded = false;
  if (staff.photo_url) {
    try {
      const img = await loadImage(staff.photo_url);
      // Cover-fit
      const iw = img.naturalWidth || img.width;
      const ih = img.naturalHeight || img.height;
      const scale = Math.max(photoSize / iw, photoSize / ih);
      const dw = iw * scale, dh = ih * scale;
      const dx = photoX + (photoSize - dw) / 2;
      const dy = photoY + (photoSize - dh) / 2;
      ctx.drawImage(img, dx, dy, dw, dh);
      photoLoaded = true;
    } catch {
      photoLoaded = false;
    }
  }
  if (!photoLoaded) {
    const initials = staff.full_name.split(' ').map(n => n.charAt(0).toUpperCase()).slice(0, 2).join('');
    ctx.fillStyle = primary; ctx.font = 'bold 96px system-ui';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(initials, photoX + photoSize / 2, photoY + photoSize / 2);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  }
  ctx.restore();
  // Photo border
  ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.roundRect(photoX, photoY, photoSize, photoSize, 12); ctx.stroke();

  // Info column
  const infoX = photoX + photoSize + 50;
  ctx.fillStyle = '#0f172a'; ctx.font = 'bold 40px system-ui';
  ctx.fillText(staff.full_name, infoX, 210);
  if (staff.role) {
    ctx.fillStyle = primary; ctx.font = '600 22px system-ui';
    ctx.fillText(staff.role, infoX, 245);
  }

  const details: [string, string][] = [];
  if (config.showStaffId && staff.staff_id) details.push(['ID NO.', staff.staff_id]);
  if (config.showDepartment && staff.department) details.push(['DEPARTMENT', staff.department]);
  if (config.showPhone && staff.phone) details.push(['PHONE', staff.phone]);
  if (config.showEmail && staff.email) details.push(['EMAIL', staff.email]);

  let dy = 300;
  for (const [label, value] of details) {
    ctx.fillStyle = '#94a3b8'; ctx.font = '600 11px system-ui';
    ctx.fillText(label, infoX, dy);
    ctx.fillStyle = '#0f172a'; ctx.font = '18px system-ui';
    ctx.fillText(value, infoX, dy + 22);
    dy += 50;
  }

  // Footer divider + meta
  ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(padX, h - 60); ctx.lineTo(w - 50, h - 60); ctx.stroke();
  ctx.fillStyle = '#64748b'; ctx.font = '14px system-ui';
  if (config.showBranch && staff.branches?.name) {
    ctx.fillText(staff.branches.name.toUpperCase(), padX, h - 30);
  }
  if (config.showEmploymentDate && staff.employment_date) {
    ctx.textAlign = 'right';
    ctx.fillText('SINCE ' + staff.employment_date, w - 50, h - 30);
    ctx.textAlign = 'left';
  }

  // Outer border
  ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(0, 0, w, h, 24); ctx.stroke();
  return canvas;
}

async function renderBack(staff: Staff, org: Organization | null, config: CardConfig): Promise<HTMLCanvasElement> {
  const w = 1012, h = 638;
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const primary = config.themeColor;

  // White background
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.roundRect(0, 0, w, h, 24); ctx.fill();

  const padX = 50;

  // Heading
  ctx.fillStyle = '#94a3b8'; ctx.font = '600 13px system-ui';
  ctx.fillText('TERMS & CONDITIONS', padX, 60);
  ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(padX, 75); ctx.lineTo(w - 350, 75); ctx.stroke();

  const orgName = org?.name || 'the organization';
  const terms = [
    `This card is property of ${orgName}.`,
    'Must be worn visibly during work hours.',
    'Report loss immediately to HR department.',
    'Not transferable to another person.',
  ];
  ctx.fillStyle = '#475569'; ctx.font = '17px system-ui';
  terms.forEach((t, i) => { ctx.fillText('•  ' + t, padX, 115 + i * 32); });

  // Org contact
  let cy = 300;
  ctx.fillStyle = '#94a3b8'; ctx.font = '600 12px system-ui';
  ctx.fillText('CONTACT', padX, cy); cy += 22;
  ctx.fillStyle = '#475569'; ctx.font = '15px system-ui';
  if (org?.email) { ctx.fillText(org.email, padX, cy); cy += 22; }
  if (org?.phone) { ctx.fillText(org.phone, padX, cy); cy += 22; }
  if (org?.address) { ctx.fillText(org.address.slice(0, 70), padX, cy); }

  // QR code
  if (config.showQR) {
    const qrValue = JSON.stringify({ staff_id: staff.id, organization_id: staff.organization_id });
    const qrDataUrl = await renderQRToDataURL(qrValue, 512);
    if (qrDataUrl) {
      const qrImg = await loadImage(qrDataUrl);
      const qrSize = 230;
      const qrX = w - qrSize - 60, qrY = 110;
      ctx.fillStyle = '#ffffff'; ctx.fillRect(qrX - 12, qrY - 12, qrSize + 24, qrSize + 24);
      ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.roundRect(qrX - 12, qrY - 12, qrSize + 24, qrSize + 24, 8); ctx.stroke();
      ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);
      ctx.fillStyle = '#94a3b8'; ctx.font = '600 11px system-ui'; ctx.textAlign = 'center';
      ctx.fillText('SCAN FOR ATTENDANCE', qrX + qrSize / 2, qrY + qrSize + 30);
      ctx.textAlign = 'left';
    }
  }

  // Bottom accent stripe
  ctx.fillStyle = primary;
  ctx.save();
  ctx.beginPath(); ctx.roundRect(0, 0, w, h, 24); ctx.clip();
  ctx.fillRect(0, h - 18, w, 18);
  ctx.restore();

  // Outer border
  ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.roundRect(0, 0, w, h, 24); ctx.stroke();
  return canvas;
}

export function StaffIDCardExport({ open, onOpenChange, singleStaff }: StaffIDCardExportProps) {
  const { data: allStaff = [] } = useStaff();
  const { data: organization } = useOrganization();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    singleStaff ? new Set([singleStaff.id]) : new Set()
  );
  const [exporting, setExporting] = useState(false);
  const [config, setConfig] = useState<CardConfig>(DEFAULT_CONFIG);
  const activeStaff = allStaff.filter(s => s.is_active);

  const toggleId = (id: string) => {
    setSelectedIds(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };

  const selectAll = () => {
    setSelectedIds(selectedIds.size === activeStaff.length ? new Set() : new Set(activeStaff.map(s => s.id)));
  };

  const exportPDF = async () => {
    setExporting(true);
    try {
      const selected = activeStaff.filter(s => selectedIds.has(s.id));
      const org = organization ?? null;
      const cardW = 85.6, cardH = 54, marginX = 12, marginY = 12, gapX = 6, gapY = 6, pageW = 210, pageH = 297;
      const cols = Math.floor((pageW - 2 * marginX + gapX) / (cardW + gapX));
      const rows = Math.floor((pageH - 2 * marginY + gapY) / (cardH + gapY));
      const cardsPerPage = cols * rows;

      const cardImages: string[] = [];
      for (const staff of selected) {
        const front = await renderFront(staff, org, config);
        cardImages.push(front.toDataURL('image/png'));
        const back = await renderBack(staff, org, config);
        cardImages.push(back.toDataURL('image/png'));
      }

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      cardImages.forEach((img, i) => {
        if (i > 0 && i % cardsPerPage === 0) pdf.addPage();
        const posOnPage = i % cardsPerPage;
        const col = posOnPage % cols;
        const row = Math.floor(posOnPage / cols);
        const x = marginX + col * (cardW + gapX);
        const y = marginY + row * (cardH + gapY);
        pdf.addImage(img, 'PNG', x, y, cardW, cardH);
      });

      pdf.save(`staff-id-cards-${new Date().toISOString().split('T')[0]}.pdf`);
    } finally { setExporting(false); }
  };

  const PRESETS = ['#0d9488', '#2563eb', '#dc2626', '#7c3aed', '#ea580c', '#0891b2', '#16a34a', '#db2777'];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Export Staff ID Cards</DialogTitle>
        </DialogHeader>

        {/* Theme Color */}
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5"><Palette className="h-3.5 w-3.5" />Theme Color</Label>
          <div className="flex items-center gap-2 flex-wrap">
            {PRESETS.map(c => (
              <button key={c} className={`w-7 h-7 rounded-full border-2 transition-all ${config.themeColor === c ? 'border-foreground scale-110' : 'border-transparent'}`}
                style={{ backgroundColor: c }} onClick={() => setConfig(prev => ({ ...prev, themeColor: c }))} />
            ))}
            <Input type="color" value={config.themeColor} onChange={e => setConfig(prev => ({ ...prev, themeColor: e.target.value }))}
              className="w-9 h-7 p-0 border-0 cursor-pointer" />
          </div>
        </div>

        {/* Card Details Toggle */}
        <div className="space-y-2">
          <Label>Card Details</Label>
          <div className="grid grid-cols-2 gap-2">
            {([
              ['showStaffId', 'Staff ID'],
              ['showDepartment', 'Department'],
              ['showPhone', 'Phone'],
              ['showEmail', 'Email'],
              ['showBranch', 'Branch'],
              ['showEmploymentDate', 'Employment Date'],
              ['showQR', 'QR Code'],
            ] as [keyof CardConfig, string][]).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={config[key] as boolean}
                  onCheckedChange={(v) => setConfig(prev => ({ ...prev, [key]: !!v }))} />
                {label}
              </label>
            ))}
          </div>
        </div>

        {/* Staff Selection */}
        {!singleStaff && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{selectedIds.size} of {activeStaff.length} selected</Label>
              <Button variant="ghost" size="sm" onClick={selectAll}>
                {selectedIds.size === activeStaff.length ? 'Deselect All' : 'Select All'}
              </Button>
            </div>
            <ScrollArea className="h-[200px] border rounded-md p-2">
              {activeStaff.map(s => (
                <label key={s.id} className="flex items-center gap-2 py-1.5 px-2 hover:bg-muted rounded cursor-pointer">
                  <Checkbox checked={selectedIds.has(s.id)} onCheckedChange={() => toggleId(s.id)} />
                  <span className="text-sm">{s.full_name}</span>
                  {s.staff_id && <span className="text-xs text-muted-foreground ml-auto font-mono">{s.staff_id}</span>}
                </label>
              ))}
            </ScrollArea>
          </div>
        )}

        <Button onClick={exportPDF} disabled={selectedIds.size === 0 || exporting} className="w-full">
          {exporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
          {exporting ? 'Generating PDF...' : `Export ${selectedIds.size} ID Card${selectedIds.size !== 1 ? 's' : ''}`}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
