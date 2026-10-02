import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { useProductVariations, formatVariationLabel, type ProductVariation } from '@/hooks/useProductVariations';
import type { Product } from '@/hooks/useProducts';
import { Checkbox } from '@/components/ui/checkbox';

interface PurchaseVariationPickerProps {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (variations: ProductVariation[]) => void;
}

export function PurchaseVariationPicker({ product, open, onOpenChange, onSelect }: PurchaseVariationPickerProps) {
  const { data: variations = [], isLoading } = useProductVariations(product?.id);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (open) setSelectedIds(new Set());
  }, [open, product?.id]);

  const toggleVariation = (variationId: string, checked: boolean) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (checked) next.add(variationId);
      else next.delete(variationId);
      return next;
    });
  };

  const addSelected = () => {
    onSelect(variations.filter((variation) => selectedIds.has(variation.id)));
    setSelectedIds(new Set());
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Select variations for {product?.name}</DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh] space-y-2 overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : variations.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No variations are configured for this item.</p>
          ) : variations.map((variation) => (
            <label
              key={variation.id}
              className="flex cursor-pointer items-center gap-3 rounded-md border p-3 hover:bg-muted/50"
            >
              <Checkbox
                checked={selectedIds.has(variation.id)}
                onCheckedChange={(checked) => toggleVariation(variation.id, checked === true)}
                aria-label={`Select ${formatVariationLabel(variation)}`}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{formatVariationLabel(variation)}</span>
                {variation.sku && <span className="block text-xs text-muted-foreground">SKU: {variation.sku}</span>}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">Stock: {Number(variation.current_stock).toLocaleString()}</span>
            </label>
          ))}
        </div>
        {!isLoading && variations.length > 0 && (
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="button" onClick={addSelected} disabled={selectedIds.size === 0}>
              Add {selectedIds.size > 0 ? `${selectedIds.size} selected` : 'selected'}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
