import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ArrowDown, ArrowUp, Minus } from 'lucide-react';
import { formatCurrency } from '@/lib/currency';
import { useProductPriceHistory } from '@/hooks/useProductPriceHistory';
import type { Product } from '@/hooks/useProducts';

interface PriceHistoryDialogProps {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function PriceDelta({ prev, next }: { prev: number; next: number }) {
  const diff = Number(next) - Number(prev);
  if (diff === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-muted-foreground text-xs">
        <Minus className="h-3 w-3" /> No change
      </span>
    );
  }
  const Icon = diff > 0 ? ArrowUp : ArrowDown;
  const color = diff > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400';
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium ${color}`}>
      <Icon className="h-3 w-3" /> {formatCurrency(Math.abs(diff))}
    </span>
  );
}

export function PriceHistoryDialog({ product, open, onOpenChange }: PriceHistoryDialogProps) {
  const { data: history, isLoading } = useProductPriceHistory(product?.id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Price History — {product?.name}</DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading…</div>
        ) : !history || history.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">No price changes recorded yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Cost: Old → New</TableHead>
                  <TableHead>Δ Cost</TableHead>
                  <TableHead className="text-right">Selling: Old → New</TableHead>
                  <TableHead>Δ Selling</TableHead>
                  <TableHead>Changed by</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell className="text-muted-foreground whitespace-nowrap">
                      {format(new Date(h.created_at), 'MMM d, yyyy HH:mm')}
                    </TableCell>
                    <TableCell>
                      <Badge variant={h.change_type === 'initial' ? 'secondary' : 'default'} className="text-xs capitalize">
                        {h.change_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <span className="text-muted-foreground">{formatCurrency(Number(h.previous_cost_price))}</span>
                      {' → '}
                      <span className="font-medium">{formatCurrency(Number(h.new_cost_price))}</span>
                    </TableCell>
                    <TableCell><PriceDelta prev={h.previous_cost_price} next={h.new_cost_price} /></TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      <span className="text-muted-foreground">{formatCurrency(Number(h.previous_selling_price))}</span>
                      {' → '}
                      <span className="font-medium">{formatCurrency(Number(h.new_selling_price))}</span>
                    </TableCell>
                    <TableCell><PriceDelta prev={h.previous_selling_price} next={h.new_selling_price} /></TableCell>
                    <TableCell className="text-muted-foreground text-sm">{h.changer_name || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}