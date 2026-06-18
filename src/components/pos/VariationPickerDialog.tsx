import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  useProductVariations,
  formatVariationLabel,
  type ProductVariation,
} from "@/hooks/useProductVariations";
import { formatCurrency } from "@/lib/currency";

interface Props {
  productId: string | null;
  productName: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSelect: (variation: ProductVariation) => void;
}

export function VariationPickerDialog({
  productId,
  productName,
  open,
  onOpenChange,
  onSelect,
}: Props) {
  const { data: variations = [], isLoading } = useProductVariations(productId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Pick a variation of {productName}</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : variations.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            No variations defined.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-2">
            {variations
              .filter((v) => v.is_active)
              .map((v) => {
                const outOfStock =
                  Number(v.current_stock) <= Number(v.out_of_stock_threshold);
                return (
                  <Button
                    key={v.id}
                    variant="outline"
                    className="justify-between h-auto py-3"
                    onClick={() => {
                      onSelect(v);
                      onOpenChange(false);
                    }}
                  >
                    <div className="flex flex-col items-start">
                      <span className="font-medium text-sm">
                        {formatVariationLabel(v)}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        SKU: {v.sku || "—"} · Stock: {Number(v.current_stock)}
                      </span>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-base font-bold text-[#FF9E3D]">
                        {formatCurrency(Number(v.selling_price))}
                      </span>
                      {outOfStock && (
                        <Badge variant="destructive" className="text-[10px]">
                          Out
                        </Badge>
                      )}
                    </div>
                  </Button>
                );
              })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
