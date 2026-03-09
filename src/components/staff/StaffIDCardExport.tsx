import { useState } from 'react';
import { jsPDF } from 'jspdf';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileDown, Loader2 } from 'lucide-react';
import { useStaff, type Staff } from '@/hooks/useStaff';
import { useOrganization, type Organization } from '@/hooks/useOrganization';
import { QRCodeSVG } from 'qrcode.react';
import { createRoot } from 'react-dom/client';

interface StaffIDCardExportProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  singleStaff?: Staff;
}

function renderCardToCanvas(staff: Staff, org: Organization | null, side: 'front' | 'back'): Promise<HTMLCanvasElement> {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    // CR80 card: 85.6mm x 53.98mm, at 300dpi ≈ 1012 x 638
    const w = 1012;
    const h = 638;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;

    // White bg
    ctx.fillStyle = '#ffffff';
    ctx.roundRect(0, 0, w, h, 20);
    ctx.fill();

    // Border
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 3;
    ctx.roundRect(0, 0, w, h, 20);
    ctx.stroke();

    if (side === 'front') {
      // Header bar
      ctx.fillStyle = '#1e40af';
      ctx.fillRect(0, 0, w, 120);

      // Org name
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 36px system-ui';
      const orgName = org?.name || 'Organization';
      ctx.fillText(orgName, 30, 55);
      ctx.font = '20px system-ui';
      ctx.fillText('Staff Identification Card', 30, 90);

      // Photo placeholder
      ctx.fillStyle = '#f1f5f9';
      ctx.fillRect(30, 150, 190, 230);
      ctx.strokeStyle = '#cbd5e1';
      ctx.lineWidth = 2;
      ctx.strokeRect(30, 150, 190, 230);
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 72px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(staff.full_name.charAt(0).toUpperCase(), 125, 295);
      ctx.textAlign = 'left';

      // Info
      const x = 260;
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 34px system-ui';
      ctx.fillText(staff.full_name, x, 200);

      ctx.fillStyle = '#64748b';
      ctx.font = '24px monospace';
      if (staff.staff_id) ctx.fillText(`ID: ${staff.staff_id}`, x, 240);

      ctx.font = '26px system-ui';
      ctx.fillStyle = '#334155';
      if (staff.role) ctx.fillText(staff.role, x, 285);
      if (staff.department) { ctx.fillStyle = '#64748b'; ctx.font = '22px system-ui'; ctx.fillText(staff.department, x, 320); }
      if (staff.branches?.name) { ctx.fillStyle = '#64748b'; ctx.font = '22px system-ui'; ctx.fillText(`📍 ${staff.branches.name}`, x, 355); }
    } else {
      // QR code - render SVG to canvas
      const qrValue = JSON.stringify({ staff_id: staff.id, organization_id: staff.organization_id });
      const svgNS = 'http://www.w3.org/2000/svg';
      
      // Create a temporary container for QR
      const tempDiv = document.createElement('div');
      tempDiv.style.position = 'absolute';
      tempDiv.style.left = '-9999px';
      document.body.appendChild(tempDiv);
      
      const root = createRoot(tempDiv);
      root.render(<QRCodeSVG value={qrValue} size={300} level="H" />);
      
      setTimeout(() => {
        const svg = tempDiv.querySelector('svg');
        if (svg) {
          const svgData = new XMLSerializer().serializeToString(svg);
          const img = new Image();
          img.onload = () => {
            const qrSize = 300;
            ctx.drawImage(img, (w - qrSize) / 2, 80, qrSize, qrSize);

            ctx.fillStyle = '#64748b';
            ctx.font = '22px system-ui';
            ctx.textAlign = 'center';
            ctx.fillText('Scan for attendance', w / 2, 420);
            
            if (org?.email) {
              ctx.fillText(`✉ ${org.email}`, w / 2, 470);
            }
            if (org?.address) {
              ctx.font = '20px system-ui';
              ctx.fillText(org.address.slice(0, 60), w / 2, 510);
            }
            ctx.textAlign = 'left';
            
            root.unmount();
            document.body.removeChild(tempDiv);
            resolve(canvas);
          };
          img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
        } else {
          root.unmount();
          document.body.removeChild(tempDiv);
          resolve(canvas);
        }
      }, 100);
    }

    if (side === 'front') {
      resolve(canvas);
    }
  });
}

export function StaffIDCardExport({ open, onOpenChange, singleStaff }: StaffIDCardExportProps) {
  const { data: allStaff = [] } = useStaff();
  const { data: organization } = useOrganization();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    singleStaff ? new Set([singleStaff.id]) : new Set()
  );
  const [exporting, setExporting] = useState(false);
  const activeStaff = allStaff.filter(s => s.is_active);

  const toggleId = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === activeStaff.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(activeStaff.map(s => s.id)));
    }
  };

  const exportPDF = async () => {
    setExporting(true);
    try {
      const selected = activeStaff.filter(s => selectedIds.has(s.id));
      // CR80: 85.6mm x 53.98mm, 2 cards per row, 4 per page
      const cardW = 85.6;
      const cardH = 54;
      const margin = 10;
      const gap = 5;
      
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = 210;
      const pageH = 297;
      
      let x = margin;
      let y = margin;
      let cardsOnPage = 0;

      for (const staff of selected) {
        // Front
        const frontCanvas = await renderCardToCanvas(staff, organization ?? null, 'front');
        const frontImg = frontCanvas.toDataURL('image/png');
        
        if (y + cardH > pageH - margin) {
          pdf.addPage();
          x = margin;
          y = margin;
          cardsOnPage = 0;
        }
        
        pdf.addImage(frontImg, 'PNG', x, y, cardW, cardH);
        
        // Move to next position
        if (x + cardW + gap + cardW <= pageW - margin) {
          x += cardW + gap;
        } else {
          x = margin;
          y += cardH + gap;
        }
        cardsOnPage++;

        // Back
        const backCanvas = await renderCardToCanvas(staff, organization ?? null, 'back');
        const backImg = backCanvas.toDataURL('image/png');
        
        if (y + cardH > pageH - margin) {
          pdf.addPage();
          x = margin;
          y = margin;
          cardsOnPage = 0;
        }
        
        pdf.addImage(backImg, 'PNG', x, y, cardW, cardH);
        
        if (x + cardW + gap + cardW <= pageW - margin) {
          x += cardW + gap;
        } else {
          x = margin;
          y += cardH + gap;
        }
        cardsOnPage++;
      }

      pdf.save(`staff-id-cards-${new Date().toISOString().split('T')[0]}.pdf`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Export Staff ID Cards</DialogTitle>
        </DialogHeader>
        {!singleStaff && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{selectedIds.size} selected</p>
              <Button variant="ghost" size="sm" onClick={selectAll}>
                {selectedIds.size === activeStaff.length ? 'Deselect All' : 'Select All'}
              </Button>
            </div>
            <ScrollArea className="h-[300px] border rounded-md p-2">
              {activeStaff.map(s => (
                <label key={s.id} className="flex items-center gap-2 py-1.5 px-2 hover:bg-muted rounded cursor-pointer">
                  <Checkbox
                    checked={selectedIds.has(s.id)}
                    onCheckedChange={() => toggleId(s.id)}
                  />
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
