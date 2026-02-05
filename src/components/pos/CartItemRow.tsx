import { useState, useEffect } from 'react';
import { Trash2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
 import { formatCurrency } from '@/lib/currency';

interface CartItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  max_quantity?: number;
  item_type: 'product' | 'service';
}

interface CartItemRowProps {
  item: CartItem;
  index: number;
  onQuantityChange: (index: number, quantity: number) => void;
  onRemove: (index: number) => void;
}

export function CartItemRow({ item, index, onQuantityChange, onRemove }: CartItemRowProps) {
  const [inputValue, setInputValue] = useState(String(item.quantity));

  useEffect(() => {
    setInputValue(String(item.quantity));
  }, [item.quantity]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
  };

  const handleInputBlur = () => {
    const newQty = parseInt(inputValue, 10);
    if (isNaN(newQty) || newQty < 1) {
      setInputValue(String(item.quantity));
      return;
    }

    // Allow exceeding stock - just update the quantity without capping
    if (newQty !== item.quantity) {
      onQuantityChange(index, newQty);
    }
    setInputValue(String(newQty));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    }
  };

  const isOverStock = item.item_type === 'product' && 
    item.max_quantity !== undefined && 
    item.quantity > item.max_quantity;

  return (
    <div className={cn(
      "flex items-center gap-2 p-2 rounded-lg",
      isOverStock ? "bg-destructive/10 border border-destructive/30" : "bg-muted/50"
    )}>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{item.product_name}</p>
        <p className="text-xs text-muted-foreground">
           {formatCurrency(item.unit_price)} × {item.quantity}
        </p>
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
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          onKeyDown={handleKeyDown}
          className={cn(
            "w-16 h-8 text-center text-sm px-1",
            isOverStock && "border-destructive"
          )}
        />
      </div>
      <div className="text-right w-20">
         <p className="font-medium text-sm">{formatCurrency(item.total_price)}</p>
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
