import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUpdateStock, type Product } from "@/hooks/useProducts";
import { Loader2, Plus, Minus } from "lucide-react";
import { getProductStockFactor, getUnitLabel } from "@/lib/product-units";

interface StockUpdateDialogProps {
  product: Product;
  type: "increase" | "decrease";
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function StockUpdateDialog({
  product,
  type,
  open,
  onOpenChange,
}: StockUpdateDialogProps) {
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [unit, setUnit] = useState<"main" | "sub">("main");
  const updateStock = useUpdateStock();

  const currentStock = Number(product.current_stock);
  const amountNum = (Number(amount) || 0) * (unit === "main" ? getProductStockFactor(product) : 1);
  const newStock =
    type === "increase" ? currentStock + amountNum : currentStock - amountNum;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (amountNum <= 0) return;
    if (type === "decrease" && newStock < 0) return;

    await updateStock.mutateAsync({
      productId: product.id,
      currentStock,
      newStock,
      changeType: type,
      notes: notes || undefined,
    });

    onOpenChange(false);
    setAmount("");
    setNotes("");
    setUnit("main");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {type === "increase" ? (
              <Plus className="h-5 w-5 text-stock-normal" />
            ) : (
              <Minus className="h-5 w-5 text-stock-out" />
            )}
            {type === "increase" ? "Add Stock" : "Remove Stock"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="p-4 rounded-lg bg-muted/50">
            <p className="font-medium">{product.name}</p>
            <p className="text-sm text-muted-foreground">
              Current stock: {currentStock.toLocaleString()}{" "}
              {product.sub_units?.abbreviation || product.units?.abbreviation || product.units?.name}
              {product.sub_unit_id && (
                <> ({(currentStock / getProductStockFactor(product)).toLocaleString()} {product.units?.abbreviation || product.units?.name})</>
              )}
            </p>
          </div>

          {product.sub_unit_id && (
            <div className="space-y-2">
              <Label>Unit</Label>
              <Select value={unit} onValueChange={(value: "main" | "sub") => setUnit(value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="main">{getUnitLabel(product, "main")}</SelectItem>
                  <SelectItem value="sub">{getUnitLabel(product, "sub")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="amount">
              Amount to {type === "increase" ? "add" : "remove"} ({getUnitLabel(product, unit)})
            </Label>
            <Input
              id="amount"
              type="number"
              min="0.00001"
              step="0.00001"
              max={type === "decrease" ? currentStock : undefined}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`Enter quantity in ${getUnitLabel(product, unit)}`}
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
                <span
                  className={`text-lg font-bold ${newStock < 0 ? "text-destructive" : "text-foreground"}`}
                >
                  {newStock.toLocaleString()}{" "}
                  {product.sub_units?.abbreviation || product.units?.abbreviation || product.units?.name}
                  {product.sub_unit_id && (
                    <> ({(newStock / getProductStockFactor(product)).toLocaleString()} {product.units?.abbreviation || product.units?.name})</>
                  )}
                </span>
              </div>
              {type === "decrease" && newStock < 0 && (
                <p className="text-sm text-destructive mt-2">
                  Cannot reduce below zero
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                updateStock.isPending ||
                amountNum <= 0 ||
                (type === "decrease" && newStock < 0)
              }
            >
              {updateStock.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                `${type === "increase" ? "Add" : "Remove"} Stock`
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
