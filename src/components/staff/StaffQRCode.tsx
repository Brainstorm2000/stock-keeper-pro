import { QRCodeSVG } from 'qrcode.react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, QrCode } from 'lucide-react';
import { useRef } from 'react';

interface StaffQRCodeProps {
  staffId: string;
  organizationId: string;
  staffName: string;
  staffCode?: string | null;
}

export function StaffQRCode({ staffId, organizationId, staffName, staffCode }: StaffQRCodeProps) {
  const qrRef = useRef<HTMLDivElement>(null);

  // Simple string format: ATT:<staffId>:<organizationId>
  const qrValue = `ATT:${staffId}:${organizationId}`;

  const handleDownload = () => {
    const svg = qrRef.current?.querySelector('svg');
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    const img = new Image();
    img.onload = () => {
      canvas.width = 400;
      canvas.height = 400;
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, 400, 400);
      ctx.drawImage(img, 0, 0, 400, 400);
      const a = document.createElement('a');
      a.download = `qr-${staffCode || staffId}.png`;
      a.href = canvas.toDataURL('image/png');
      a.click();
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <QrCode className="h-4 w-4" />
          Attendance QR Code
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-3">
        <div ref={qrRef} className="p-3 bg-white rounded-lg">
          <QRCodeSVG value={qrValue} size={240} level="M" includeMargin />
        </div>
        <p className="text-xs text-muted-foreground text-center">{staffName}</p>
        <Button variant="outline" size="sm" onClick={handleDownload}>
          <Download className="mr-2 h-3 w-3" />
          Download QR
        </Button>
      </CardContent>
    </Card>
  );
}
