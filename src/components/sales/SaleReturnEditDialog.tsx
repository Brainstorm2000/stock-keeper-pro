import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useUpdateSaleReturn, useAlreadyReturnedQuantities, type SaleReturn } from '@/hooks/useSaleReturns';
import { supabase } from '@/integrations/supabase/client';
import { formatCurrency } from '@/lib/currency';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';

interface EditableItem {
  product_id: string;
  variation_id: string | null;
  product_name: string;
  max_quantity: number;
  quantity: number;
  unit_price: number;
  selected: boolean;
}

interface SaleItemOption {
  product_id: string;
  variation_id: string | null;
  quantity: number;
  unit_price: number;
  products: { name: string } | null;
  product_variations: { sku: string | null } | null;
}

interface SaleReturnEditDialogProps {
  saleReturn: SaleReturn | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const itemKey = (productId: string, variationId: string | null) => `${productId}:${variationId || ''}`;

export function SaleReturnEditDialog({ saleReturn, open, onOpenChange }: SaleReturnEditDialogProps) {
  const updateReturn = useUpdateSaleReturn();
  const { data: alreadyReturned = {} } = useAlreadyReturnedQuantities(saleReturn?.sale_id);
  const [items, setItems] = useState<EditableItem[]>([]);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [refundMethod, setRefundMethod] = useState('cash');
  const [returnDate, setReturnDate] = useState('');
  const [loadingItems, setLoadingItems] = useState(false);

  useEffect(() => {
    if (!open || !saleReturn) return;
    let cancelled = false;
    setLoadingItems(true);
    setReason(saleReturn.reason || '');
    setNotes(saleReturn.notes || '');
    setRefundMethod(saleReturn.refund_method || 'cash');
    setReturnDate(saleReturn.return_date);

    Promise.all([
      supabase
        .from('sale_items')
        .select('product_id, variation_id, quantity, unit_price, products(name), product_variations(sku)')
        .eq('sale_id', saleReturn.sale_id),
      supabase
        .from('sale_return_items')
        .select('product_id, variation_id, quantity, sale_returns!inner(sale_id)')
        .eq('sale_returns.sale_id', saleReturn.sale_id)
        .neq('return_id', saleReturn.id),
    ]).then(([saleItemsResult, otherReturnsResult]) => {
      if (cancelled) return;
      if (saleItemsResult.error || otherReturnsResult.error) {
        setItems([]);
        return;
      }

      const sold = new Map<string, number>();
      const otherReturned = new Map<string, number>();
      for (const item of saleItemsResult.data || []) {
        const key = itemKey(item.product_id, item.variation_id);
        sold.set(key, (sold.get(key) || 0) + Number(item.quantity));
      }
      for (const item of otherReturnsResult.data || []) {
        const key = itemKey(item.product_id, item.variation_id);
        otherReturned.set(key, (otherReturned.get(key) || 0) + Number(item.quantity));
      }
      const currentItems = new Map((saleReturn.sale_return_items || []).map(item => [
        itemKey(item.product_id, item.variation_id), item,
      ]));

      const saleItemOptions = (saleItemsResult.data || []) as unknown as SaleItemOption[];
      setItems(saleItemOptions.map(saleItem => {
        const key = itemKey(saleItem.product_id, saleItem.variation_id);
        const current = currentItems.get(key);
        const maximum = Math.max(0, (sold.get(key) || 0) - (otherReturned.get(key) || 0));
        return {
          product_id: saleItem.product_id,
          variation_id: saleItem.variation_id,
          product_name: `${saleItem.products?.name || 'Unknown'}${saleItem.product_variations?.sku ? ` (${saleItem.product_variations.sku})` : ''}`,
          max_quantity: maximum,
          quantity: current ? Number(current.quantity) : maximum,
          unit_price: Number(current?.unit_price ?? saleItem.unit_price),
          selected: !!current,
        };
      }).filter(item => item.max_quantity > 0));
    }).finally(() => {
      if (!cancelled) setLoadingItems(false);
    });

    return () => { cancelled = true; };
  }, [open, saleReturn]);

  const selectedItems = items.filter(item => item.selected && item.quantity > 0);
  const total = selectedItems.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);

  const handleSave = async () => {
    if (!saleReturn || selectedItems.length === 0) return;
    await updateReturn.mutateAsync({
      saleReturn,
      refund_method: refundMethod,
      return_date: returnDate,
      reason: reason || null,
      notes: notes || null,
      items: selectedItems.map(item => ({
        product_id: item.product_id,
        variation_id: item.variation_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
      })),
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Sale Return {saleReturn?.return_number}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sale-return-date">Return Date</Label>
              <Input id="sale-return-date" type="date" value={returnDate} onChange={event => setReturnDate(event.target.value)} />
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

          {loadingItems ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Qty (max)</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, index) => (
                    <TableRow key={itemKey(item.product_id, item.variation_id)}>
                      <TableCell>
                        <Checkbox
                          checked={item.selected}
                          onCheckedChange={checked => setItems(current => current.map((row, rowIndex) => rowIndex === index ? { ...row, selected: !!checked } : row))}
                        />
                      </TableCell>
                      <TableCell>{item.product_name}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={1}
                          max={item.max_quantity}
                          value={item.quantity}
                          disabled={!item.selected}
                          className="w-24"
                          onChange={event => setItems(current => current.map((row, rowIndex) => rowIndex === index ? {
                            ...row,
                            quantity: Math.min(row.max_quantity, Math.max(1, Number(event.target.value) || 1)),
                          } : row))}
                        />
                        <span className="ml-1 text-xs text-muted-foreground">/ {item.max_quantity}</span>
                      </TableCell>
                      <TableCell className="text-right">{formatCurrency(item.unit_price)}</TableCell>
                      <TableCell className="text-right">{item.selected ? formatCurrency(item.quantity * item.unit_price) : '—'}</TableCell>
                    </TableRow>
                  ))}
                  {items.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">No editable sale items found.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="sale-return-reason">Reason</Label>
            <Input id="sale-return-reason" value={reason} onChange={event => setReason(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sale-return-notes">Notes</Label>
            <Textarea id="sale-return-notes" value={notes} onChange={event => setNotes(event.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter className="flex-row items-center justify-between sm:justify-between">
          <div className="font-semibold">Refund Total: {formatCurrency(total)}</div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={loadingItems || selectedItems.length === 0 || updateReturn.isPending}>
              {updateReturn.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : 'Save Changes'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}