import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useUpdateStock, type Product } from '@/hooks/useProducts';
import { Loader2, Plus, Minus } from 'lucide-react';

interface StockUpdateDialogProps {
  product: Product;
  type: 'increase' | 'decrease';
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StockUpdateDialog({ product, type, open, onOpenChange }: StockUpdateDialogProps) {
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const updateStock = useUpdateStock();

  const currentStock = Number(product.current_stock);
  const amountNum = Number(amount) || 0;
  const newStock = type === 'increase' ? currentStock + amountNum : currentStock - amountNum;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (amountNum <= 0) return;
    if (type === 'decrease' && newStock < 0) return;

    await updateStock.mutateAsync({
      productId: product.id,
      currentStock,
      newStock,
      changeType: type,
      notes: notes || undefined,
    });

    onOpenChange(false);
    setAmount('');
    setNotes('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {type === 'increase' ? (
              <Plus className="h-5 w-5 text-stock-normal" />
            ) : (
              <Minus className="h-5 w-5 text-stock-out" />
            )}
            {type === 'increase' ? 'Add Stock' : 'Remove Stock'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="p-4 rounded-lg bg-muted/50">
            <p className="font-medium">{product.name}</p>
            <p className="text-sm text-muted-foreground">
              Current stock: {currentStock.toLocaleString()} {product.units?.abbreviation || product.units?.name}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Amount to {type === 'increase' ? 'add' : 'remove'}</Label>
            <Input
              id="amount"
              type="number"
              min="1"
              max={type === 'decrease' ? currentStock : undefined}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="Enter quantity"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about this change..."
              rows={2}
            />
          </div>

          {amountNum > 0 && (
            <div className="p-4 rounded-lg border bg-card">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">New stock level:</span>
                <span className={`text-lg font-bold ${newStock < 0 ? 'text-destructive' : 'text-foreground'}`}>
                  {newStock.toLocaleString()}
                </span>
              </div>
              {type === 'decrease' && newStock < 0 && (
                <p className="text-sm text-destructive mt-2">Cannot reduce below zero</p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={updateStock.isPending || amountNum <= 0 || (type === 'decrease' && newStock < 0)}
            >
              {updateStock.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                `${type === 'increase' ? 'Add' : 'Remove'} Stock`
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
