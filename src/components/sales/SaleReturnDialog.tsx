import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2 } from 'lucide-react';
import { useCreateSaleReturn, useAlreadyReturnedQuantities } from '@/hooks/useSaleReturns';
import { useOrganization } from '@/hooks/useOrganization';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/currency';
import type { Sale } from '@/hooks/useSales';

interface SaleReturnDialogProps {
  sale: Sale | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface ReturnItem {
  product_id: string;
  product_name: string;
  max_quantity: number;
  quantity: number;
  unit_price: number;
  selected: boolean;
}

export function SaleReturnDialog({ sale, open, onOpenChange }: SaleReturnDialogProps) {
  const { data: organization } = useOrganization();
  const createReturn = useCreateSaleReturn();
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [refundMethod, setRefundMethod] = useState('cash');
  const [items, setItems] = useState<ReturnItem[]>([]);

  useEffect(() => {
    if (open && sale) {
      // Fetch sale items
      supabase
        .from('sale_items')
        .select('*, products(name)')
        .eq('sale_id', sale.id)
        .then(({ data }) => {
          if (data) {
            setItems(data.map((si: any) => ({
              product_id: si.product_id,
              product_name: si.products?.name || 'Unknown',
              max_quantity: si.quantity,
              quantity: si.quantity,
              unit_price: si.unit_price,
              selected: false,
            })));
          }
        });
      setReason('');
      setNotes('');
      setRefundMethod('cash');
    }
  }, [open, sale]);

  const selectedItems = items.filter(i => i.selected && i.quantity > 0);
  const totalReturn = selectedItems.reduce((s, i) => s + i.quantity * i.unit_price, 0);

  const handleSubmit = async () => {
    if (!organization?.id || !sale || selectedItems.length === 0) return;
    await createReturn.mutateAsync({
      organization_id: organization.id,
      sale_id: sale.id,
      branch_id: sale.branch_id,
      refund_method: refundMethod,
      reason: reason || undefined,
      notes: notes || undefined,
      items: selectedItems.map(i => ({
        product_id: i.product_id,
        quantity: i.quantity,
        unit_price: i.unit_price,
      })),
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Return Items — {sale?.sale_number}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Reason</Label>
              <Input value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g., Defective product" />
            </div>
            <div className="space-y-2">
              <Label>Refund Method</Label>
              <Select value={refundMethod} onValueChange={setRefundMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash">Cash</SelectItem>
                  <SelectItem value="card">Card</SelectItem>
                  <SelectItem value="mobile_money">Mobile Money</SelectItem>
                  <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  <SelectItem value="store_credit">Store Credit</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10"></TableHead>
                <TableHead>Product</TableHead>
                <TableHead className="w-[100px]">Qty (max)</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
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
                        newItems[idx].selected = !!c;
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
                        newItems[idx].quantity = Math.min(item.max_quantity, Math.max(1, Number(e.target.value) || 1));
                        setItems(newItems);
                      }}
                      className="w-20"
                      disabled={!item.selected}
                    />
                    <span className="text-xs text-muted-foreground ml-1">/ {item.max_quantity}</span>
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(item.unit_price)}</TableCell>
                  <TableCell className="text-right">{item.selected ? formatCurrency(item.quantity * item.unit_price) : '—'}</TableCell>
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
            <div className="text-lg font-bold">Refund Total: {formatCurrency(totalReturn)}</div>
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
