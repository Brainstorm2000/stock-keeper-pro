import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type StockStatus = 'normal' | 'low' | 'out';

interface StatusBadgeProps {
  status: StockStatus;
  className?: string;
}

const statusConfig: Record<StockStatus, { label: string; className: string }> = {
  normal: {
    label: 'In Stock',
    className: 'status-normal',
  },
  low: {
    label: 'Low Stock',
    className: 'status-low',
  },
  out: {
    label: 'Out of Stock',
    className: 'status-out',
  },
};

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <Badge className={cn(config.className, 'font-medium', className)}>
      {config.label}
    </Badge>
  );
}

export function getStockStatus(
  currentStock: number,
  lowThreshold: number,
  outThreshold: number,
  itemType?: 'product' | 'service' | 'variable'
): StockStatus {
  // Services don't have stock constraints - always available
  if (itemType === 'service') return 'normal';
  
  if (currentStock <= outThreshold) return 'out';
  if (currentStock <= lowThreshold) return 'low';
  return 'normal';
}
