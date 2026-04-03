import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2 } from 'lucide-react';
import { useCreatePurchaseReturn, useAlreadyReturnedPurchaseQuantities } from '@/hooks/usePurchaseReturns';
import { useOrganization } from '@/hooks/useOrganization';
import type { Purchase } from '@/hooks/usePurchases';
import { formatCurrency } from '@/lib/currency';

interface PurchaseReturnDialogProps {
  purchase: Purchase | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ReturnItem {
  product_id: string;
  product_name: string;
  max_quantity: number;
  quantity: number;
  unit_cost: number;
  selected: boolean;
}

export function PurchaseReturnDialog({ purchase, open, onOpenChange }: PurchaseReturnDialogProps) {
  const { data: organization } = useOrganization();
  const createReturn = useCreatePurchaseReturn();
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState<ReturnItem[]>([]);

  useEffect(() => {
    if (open && purchase?.purchase_items) {
      setItems(purchase.purchase_items.map(pi => ({
        product_id: pi.product_id,
        product_name: pi.products?.name || 'Unknown',
        max_quantity: pi.quantity,
        quantity: pi.quantity,
        unit_cost: pi.unit_cost,
        selected: false,
      })));
      setReason('');
      setNotes('');
    }
  }, [open, purchase]);

  const selectedItems = items.filter(i => i.selected && i.quantity > 0);
  const totalReturn = selectedItems.reduce((s, i) => s + i.quantity * i.unit_cost, 0);

  const handleSubmit = async () => {
    if (!organization?.id || !purchase || selectedItems.length === 0) return;
    await createReturn.mutateAsync({
      organization_id: organization.id,
      purchase_id: purchase.id,
      branch_id: purchase.branch_id,
      reason: reason || undefined,
      notes: notes || undefined,
      items: selectedItems.map(i => ({
        product_id: i.product_id,
        quantity: i.quantity,
        unit_cost: i.unit_cost,
      })),
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Return Items — {purchase?.purchase_number}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Reason</Label>
            <Input value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g., Damaged goods" />
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>Product</TableHead>
                <TableHead className="w-[100px]">Qty (max)</TableHead>
                <TableHead className="text-right">Unit Cost</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item, idx) => (
                <TableRow key={item.product_id}>
                  <TableCell>
                    <Checkbox
                      checked={item.selected}
                      onCheckedChange={c => {
                        const newItems = [...items];
                        newItems[idx] = { ...newItems[idx], selected: !!c };
                        setItems(newItems);
                      }}
                    />
                  </TableCell>
                  <TableCell>{item.product_name}</TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={1}
                      max={item.max_quantity}
                      value={item.quantity}
                      onChange={e => {
                        const newItems = [...items];
                        newItems[idx] = {
                          ...newItems[idx],
                          quantity: Math.min(item.max_quantity, Math.max(1, Number(e.target.value) || 1)),
                        };
                        setItems(newItems);
                      }}
                      className="w-20"
                      disabled={!item.selected}
                    />
                    <span className="text-xs text-muted-foreground ml-1">/ {item.max_quantity}</span>
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(item.unit_cost)}</TableCell>
                  <TableCell className="text-right">{item.selected ? formatCurrency(item.quantity * item.unit_cost) : '—'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
          </div>
        </div>

        <DialogFooter>
          <div className="flex items-center justify-between w-full">
            <div className="text-lg font-bold">Return Total: {formatCurrency(totalReturn)}</div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={selectedItems.length === 0 || createReturn.isPending}>
                {createReturn.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...</> : 'Process Return'}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
