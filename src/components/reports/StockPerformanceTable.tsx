import { ArrowDown, ArrowUp, ChevronsUpDown, AlertCircle } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { formatCurrency } from '@/lib/currency';
import { cn } from '@/lib/utils';
import type { PerformanceRow, PerformanceSortKey } from '@/hooks/useStockPerformance';

interface Props {
  rows: PerformanceRow[];
  loading: boolean;
  error?: Error | null;
  sort: PerformanceSortKey;
  dir: 'asc' | 'desc';
  onSort: (key: PerformanceSortKey) => void;
}

const COLUMNS: { key: PerformanceSortKey | null; label: string; align?: 'right'; sortable?: boolean }[] = [
  { key: null, label: 'SKU' },
  { key: 'product_name', label: 'Product Name', sortable: true },
  { key: 'opening_stock', label: 'Opening Stock', align: 'right', sortable: true },
  { key: 'units_sold', label: 'Quantity Sold', align: 'right', sortable: true },
  { key: 'current_stock', label: 'Current Stock', align: 'right', sortable: true },
  { key: 'cost_price', label: 'Unit Cost', align: 'right', sortable: true },
  { key: 'selling_price', label: 'Unit Price', align: 'right', sortable: true },
  { key: 'revenue', label: 'Total Revenue', align: 'right', sortable: true },
  { key: 'gross_profit', label: 'Gross Profit', align: 'right', sortable: true },
  { key: 'margin', label: 'Profit Margin (%)', align: 'right', sortable: true },
];

export function statusLabel(status: PerformanceRow['stock_status']) {
  return status === 'out' ? 'Out of Stock' : status === 'low' ? 'Low Stock' : 'Normal';
}

export function velocityLabel(velocity: PerformanceRow['velocity']) {
  return velocity === 'fast' ? 'Fast Mover' : 'Slow / Dead';
}

export function StockPerformanceTable({ rows, loading, error, sort, dir, onSort }: Props) {
  if (error) {
    return (
      <div className="flex flex-col items-center gap-2 py-16 text-center">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="font-medium">Could not load the performance report</p>
        <p className="text-sm text-muted-foreground">{error.message}</p>
      </div>
    );
  }

  return (
    <div className="relative w-full overflow-x-auto print-table">
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-muted/95 backdrop-blur">
          <TableRow>
            {COLUMNS.map((col) => (
              <TableHead
                key={col.label}
                className={cn(
                  'whitespace-nowrap',
                  col.align === 'right' && 'text-right',
                  col.sortable && 'cursor-pointer select-none',
                )}
                onClick={() => col.sortable && col.key && onSort(col.key)}
              >
                <span className={cn('inline-flex items-center gap-1', col.align === 'right' && 'justify-end')}>
                  {col.label}
                  {col.sortable && col.key && (
                    sort === col.key
                      ? dir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                      : <ChevronsUpDown className="h-3 w-3 opacity-30 no-print" />
                  )}
                </span>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading && rows.length === 0 &&
            Array.from({ length: 8 }).map((_, i) => (
              <TableRow key={`sk-${i}`}>
                {COLUMNS.map((c) => (
                  <TableCell key={c.label}><Skeleton className="h-4 w-full" /></TableCell>
                ))}
              </TableRow>
            ))}

          {!loading && rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={COLUMNS.length} className="py-16 text-center text-muted-foreground">
                No products match the selected period and filters.
              </TableCell>
            </TableRow>
          )}

          {rows.map((r) => (
            <TableRow key={r.product_id} className="print-row">
              <TableCell className="whitespace-nowrap">{r.sku || '-'}</TableCell>
              <TableCell className="min-w-[200px]">
                <div className="font-medium">{r.product_name}</div>
              </TableCell>
              <TableCell className="text-right tabular-nums">{Number(r.opening_stock)}</TableCell>
              <TableCell className="text-right tabular-nums">{Number(r.units_sold)}</TableCell>
              <TableCell className="text-right font-medium tabular-nums">{Number(r.current_stock)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrency(Number(r.cost_price))}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrency(Number(r.selling_price))}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrency(Number(r.revenue))}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrency(Number(r.gross_profit))}</TableCell>
              <TableCell className="text-right tabular-nums">{Number(r.margin).toFixed(1)}%</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}