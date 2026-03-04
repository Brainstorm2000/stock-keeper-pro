import { useState } from 'react';
import { AlertTriangle, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useProducts } from '@/hooks/useProducts';
import { useRecordDamage } from '@/hooks/useWorkOrders';
import { formatCurrency } from '@/lib/currency';

export function DamagesTab() {
  const { data: products = [] } = useProducts();
  const recordDamage = useRecordDamage();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [damageQty, setDamageQty] = useState('');
  const [damageNotes, setDamageNotes] = useState('');

  const selectedProduct = products.find((p) => p.id === selectedProductId);

  const handleRecordDamage = async () => {
    if (!selectedProductId || !damageQty || Number(damageQty) <= 0) return;
    await recordDamage.mutateAsync({
      productId: selectedProductId,
      quantity: Number(damageQty),
      notes: damageNotes || undefined,
    });
    setDialogOpen(false);
    setSelectedProductId('');
    setDamageQty('');
    setDamageNotes('');
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-destructive/10">
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Record Damages & Waste</p>
                <p className="text-sm text-muted-foreground mt-1">Track damaged finished goods and wasted raw materials to maintain accurate inventory.</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end">
        <Button variant="destructive" onClick={() => setDialogOpen(true)}>
          <AlertTriangle className="h-4 w-4 mr-2" />Record Finished Goods Damage
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground text-center py-4">
            Use the button above to record damage to finished goods. Raw material waste can be recorded from the Raw Materials tab using the ⚠ icon.
          </p>
        </CardContent>
      </Card>

      {/* Record Damage Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setSelectedProductId(''); setDamageQty(''); setDamageNotes(''); } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Record Finished Goods Damage</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Product *</Label>
              <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name} (Stock: {Number(p.current_stock)})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedProduct && (
              <div className="text-sm text-muted-foreground p-3 rounded-md bg-muted">
                <p>Current Stock: <span className="font-semibold text-foreground">{Number(selectedProduct.current_stock)}</span></p>
                <p>Value per unit: <span className="font-semibold text-foreground">{formatCurrency(selectedProduct.cost_price)}</span></p>
              </div>
            )}
            <div className="space-y-2">
              <Label>Damaged Quantity *</Label>
              <Input type="number" min="1" max={selectedProduct ? Number(selectedProduct.current_stock) : undefined} value={damageQty} onChange={(e) => setDamageQty(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Reason / Notes</Label>
              <Textarea value={damageNotes} onChange={(e) => setDamageNotes(e.target.value)} rows={2} placeholder="e.g. Broken during handling, defective batch..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleRecordDamage} disabled={!selectedProductId || !damageQty || Number(damageQty) <= 0}>
              Record Damage
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
