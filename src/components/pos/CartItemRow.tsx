import { useState, useEffect } from "react";
import { Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/currency";

interface CartItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  max_quantity?: number;
  item_type: "product" | "service" | "variable";
}

interface CartItemRowProps {
  item: CartItem;
  index: number;
  onQuantityChange: (index: number, quantity: number) => void;
  onPriceChange: (index: number, price: number) => void;
  onRemove: (index: number) => void;
}

export function CartItemRow({
  item,
  index,
  onQuantityChange,
  onPriceChange,
  onRemove,
}: CartItemRowProps) {
  const [qtyInput, setQtyInput] = useState(String(item.quantity));
  const [priceInput, setPriceInput] = useState(String(item.unit_price));

  useEffect(() => {
    setQtyInput(String(item.quantity));
  }, [item.quantity]);

  useEffect(() => {
    setPriceInput(String(item.unit_price));
  }, [item.unit_price]);

  const handleQtyBlur = () => {
    const val = parseInt(qtyInput, 10);
    if (isNaN(val) || val < 1) {
      setQtyInput(String(item.quantity));
      return;
    }
    if (val !== item.quantity) onQuantityChange(index, val);
    setQtyInput(String(val));
  };

  const handlePriceBlur = () => {
    const val = parseFloat(priceInput);
    if (isNaN(val) || val < 0) {
      setPriceInput(String(item.unit_price));
      return;
    }
    if (val !== item.unit_price) onPriceChange(index, val);
    setPriceInput(String(val));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
  };

  const isOverStock =
    item.item_type === "product" &&
    item.max_quantity !== undefined &&
    item.quantity > item.max_quantity;

  return (
    <div
      className={cn(
        "flex items-center gap-2 p-2 rounded-lg",
        isOverStock
          ? "bg-destructive/10 border border-destructive/30"
          : "bg-muted/50",
      )}
    >
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">
          {item.product_name.length > 10
            ? `${item.product_name.substring(0, 10)}...`
            : item.product_name}
        </p>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <span>@</span>
          <Input
            type="number"
            min="0"
            step="0.01"
            value={priceInput}
            onChange={(e) => setPriceInput(e.target.value)}
            onBlur={handlePriceBlur}
            onKeyDown={handleKeyDown}
            className="w-20 h-6 text-xs px-1 py-0 inline-flex"
          />
          <span>× {item.quantity}</span>
        </div>
        {isOverStock && (
          <div className="flex items-center gap-1 text-destructive text-xs mt-1">
            <AlertTriangle className="h-3 w-3" />
            <span>Exceeds stock ({item.max_quantity} available)</span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-1">
        <Input
          type="number"
          min="1"
          value={qtyInput}
          onChange={(e) => setQtyInput(e.target.value)}
          onBlur={handleQtyBlur}
          onKeyDown={handleKeyDown}
          className={cn(
            "w-16 h-8 text-center text-sm px-1",
            isOverStock && "border-destructive",
          )}
        />
      </div>
      <div className="text-right w-20">
        <p className="font-medium text-sm">
          {formatCurrency(item.total_price)}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 text-destructive shrink-0"
        onClick={() => onRemove(index)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
