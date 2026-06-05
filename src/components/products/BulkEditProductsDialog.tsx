import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBulkUpdateProducts } from "@/hooks/useProducts";

interface BulkEditProductsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedIds: string[];
  onDone?: () => void;
}

const NO_CHANGE = "__no_change__";

export function BulkEditProductsDialog({
  open,
  onOpenChange,
  selectedIds,
  onDone,
}: BulkEditProductsDialogProps) {
  const bulkUpdate = useBulkUpdateProducts();
  const [category, setCategory] = useState<string>(NO_CHANGE);
  const [lowStock, setLowStock] = useState<string>("");
  const [outStock, setOutStock] = useState<string>("");
  const [costPrice, setCostPrice] = useState<string>("");
  const [sellingPrice, setSellingPrice] = useState<string>("");

  useEffect(() => {
    if (open) {
      setCategory(NO_CHANGE);
      setLowStock("");
      setOutStock("");
      setCostPrice("");
      setSellingPrice("");
    }
  }, [open]);

  const handleApply = async () => {
    const patch: Record<string, unknown> = {};
    if (category !== NO_CHANGE) patch.category = category;
    if (lowStock.trim() !== "") patch.low_stock_threshold = Number(lowStock);
    if (outStock.trim() !== "") patch.out_of_stock_threshold = Number(outStock);
    if (costPrice.trim() !== "") patch.cost_price = Number(costPrice);
    if (sellingPrice.trim() !== "") patch.selling_price = Number(sellingPrice);

    if (Object.keys(patch).length === 0) {
      onOpenChange(false);
      return;
    }
    await bulkUpdate.mutateAsync({ ids: selectedIds, patch });
    onOpenChange(false);
    onDone?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Bulk Edit Products</DialogTitle>
          <DialogDescription>
            Update fields for {selectedIds.length} selected product
            {selectedIds.length === 1 ? "" : "s"}. Leave a field blank to keep
            its current value.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_CHANGE}>No change</SelectItem>
                <SelectItem value="sellable">Sellable</SelectItem>
                <SelectItem value="consumable">Consumable</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Low Stock Threshold</Label>
              <Input
                type="number"
                min={0}
                value={lowStock}
                onChange={(e) => setLowStock(e.target.value)}
                placeholder="No change"
              />
            </div>
            <div className="space-y-2">
              <Label>Out of Stock Threshold</Label>
              <Input
                type="number"
                min={0}
                value={outStock}
                onChange={(e) => setOutStock(e.target.value)}
                placeholder="No change"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Cost Price (₦)</Label>
              <Input
                type="number"
                min={0}
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                placeholder="No change"
              />
            </div>
            <div className="space-y-2">
              <Label>Selling Price (₦)</Label>
              <Input
                type="number"
                min={0}
                value={sellingPrice}
                onChange={(e) => setSellingPrice(e.target.value)}
                placeholder="No change"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleApply} disabled={bulkUpdate.isPending}>
            {bulkUpdate.isPending ? "Applying..." : "Apply Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}