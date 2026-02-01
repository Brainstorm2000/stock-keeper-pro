import { useState, useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

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

    const maxQty = item.item_type === 'service' ? Infinity : (item.max_quantity || Infinity);
    const validQty = Math.min(newQty, maxQty);
    
    if (validQty !== item.quantity) {
      onQuantityChange(index, validQty);
    }
    setInputValue(String(validQty));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{item.product_name}</p>
        <p className="text-xs text-muted-foreground">
          {item.unit_price.toLocaleString()} × {item.quantity}
        </p>
      </div>
      <div className="flex items-center gap-1">
        <Input
          type="number"
          min="1"
          max={item.item_type === 'service' ? undefined : item.max_quantity}
          value={inputValue}
          onChange={handleInputChange}
          onBlur={handleInputBlur}
          onKeyDown={handleKeyDown}
          className="w-16 h-8 text-center text-sm px-1"
        />
      </div>
      <div className="text-right w-20">
        <p className="font-medium text-sm">{item.total_price.toLocaleString()}</p>
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
