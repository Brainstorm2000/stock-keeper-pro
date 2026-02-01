import { useRef } from 'react';
import { Printer, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { ThermalReceipt } from './ThermalReceipt';
import type { Sale } from '@/hooks/useSales';

interface ReceiptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sale: Sale | null;
  organizationName?: string;
  organizationAddress?: string;
  organizationEmail?: string;
  showSuccessMessage?: boolean;
  onNewSale?: () => void;
}

export function ReceiptDialog({
  open,
  onOpenChange,
  sale,
  organizationName,
  organizationAddress,
  organizationEmail,
  showSuccessMessage = false,
  onNewSale,
}: ReceiptDialogProps) {
  const receiptRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    if (!receiptRef.current) return;

    const printWindow = window.open('', '_blank', 'width=250,height=600');
    if (!printWindow) return;

    const receiptHTML = receiptRef.current.innerHTML;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Receipt - ${sale?.sale_number || ''}</title>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: 'Courier New', monospace;
              font-size: 10px;
              line-height: 1.2;
              width: 58mm;
              max-width: 58mm;
              padding: 2mm;
              background: white;
              color: black;
            }
            .thermal-receipt {
              width: 100%;
            }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .font-bold { font-weight: bold; }
            .font-medium { font-weight: 500; }
            .uppercase { text-transform: uppercase; }
            .text-sm { font-size: 12px; }
            .text-xs { font-size: 11px; }
            .text-\\[9px\\] { font-size: 9px; }
            .text-\\[10px\\] { font-size: 10px; }
            .text-\\[8px\\] { font-size: 8px; }
            .truncate { 
              overflow: hidden; 
              text-overflow: ellipsis; 
              white-space: nowrap; 
            }
            .max-w-\\[60\\%\\] { max-width: 60%; }
            .flex { display: flex; }
            .justify-between { justify-content: space-between; }
            .space-y-1 > * + * { margin-top: 4px; }
            .space-y-0\\.5 > * + * { margin-top: 2px; }
            .my-1 { margin-top: 4px; margin-bottom: 4px; }
            .my-0\\.5 { margin-top: 2px; margin-bottom: 2px; }
            .mt-1 { margin-top: 4px; }
            .mb-2 { margin-bottom: 8px; }
            .pl-2 { padding-left: 8px; }
            .p-2 { padding: 8px; }
            .border-t { border-top: 1px solid black; }
            .border-dashed { border-style: dashed; }
            .border-black { border-color: black; }
            .whitespace-pre-wrap { white-space: pre-wrap; }
            .text-gray-500 { color: #666; }
            @media print {
              @page {
                size: 58mm auto;
                margin: 0;
              }
              body {
                width: 58mm;
              }
            }
          </style>
        </head>
        <body>
          ${receiptHTML}
          <script>
            window.onload = function() {
              window.print();
              window.onafterprint = function() {
                window.close();
              };
              setTimeout(function() {
                window.close();
              }, 2000);
            };
          </script>
        </body>
      </html>
    `);

    printWindow.document.close();
  };

  if (!sale) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-center">
            {showSuccessMessage ? 'Sale Complete!' : `Receipt - ${sale.sale_number}`}
          </DialogTitle>
        </DialogHeader>

        {showSuccessMessage && (
          <div className="text-center py-2">
            <div className="text-5xl text-primary mb-2">✓</div>
          </div>
        )}

        {/* Receipt Preview */}
        <div className="flex justify-center bg-muted p-4 rounded-lg overflow-auto">
          <ThermalReceipt
            ref={receiptRef}
            sale={sale}
            organizationName={organizationName}
            organizationAddress={organizationAddress}
            organizationEmail={organizationEmail}
          />
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={handlePrint} className="flex-1">
            <Printer className="h-4 w-4 mr-2" />
            Print Receipt
          </Button>
          {showSuccessMessage && onNewSale ? (
            <Button onClick={onNewSale} className="flex-1">
              New Sale
            </Button>
          ) : (
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              <X className="h-4 w-4 mr-2" />
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
