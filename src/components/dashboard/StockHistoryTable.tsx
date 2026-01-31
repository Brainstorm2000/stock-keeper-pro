import { format } from 'date-fns';
import { ArrowUp, ArrowDown, RefreshCw, Package } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useStockHistory, type StockHistoryEntry } from '@/hooks/useStockHistory';

interface StockHistoryTableProps {
  productId?: string;
  limit?: number;
}

function getChangeIcon(changeType: string) {
  switch (changeType) {
    case 'increase':
      return <ArrowUp className="h-4 w-4 text-stock-normal" />;
    case 'decrease':
      return <ArrowDown className="h-4 w-4 text-destructive" />;
    case 'adjustment':
      return <RefreshCw className="h-4 w-4 text-stock-low" />;
    default:
      return <Package className="h-4 w-4 text-muted-foreground" />;
  }
}

function getChangeBadgeVariant(changeType: string) {
  switch (changeType) {
    case 'increase':
      return 'default';
    case 'decrease':
      return 'destructive';
    case 'adjustment':
      return 'secondary';
    default:
      return 'outline';
  }
}

export function StockHistoryTable({ productId, limit = 20 }: StockHistoryTableProps) {
  const { data: history, isLoading } = useStockHistory(productId, limit);

  if (isLoading) {
    return (
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Recent Stock Changes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card animate-fade-in">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Recent Stock Changes</CardTitle>
      </CardHeader>
      <CardContent>
        {history && history.length > 0 ? (
          <div className="relative overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  {!productId && <TableHead>Product</TableHead>}
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Previous</TableHead>
                  <TableHead className="text-right">Change</TableHead>
                  <TableHead className="text-right">New</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {format(new Date(entry.created_at), 'MMM d, yyyy HH:mm')}
                    </TableCell>
                    {!productId && (
                      <TableCell className="font-medium">
                        {entry.products?.name || 'Unknown'}
                      </TableCell>
                    )}
                    <TableCell>
                      <Badge variant={getChangeBadgeVariant(entry.change_type)} className="flex items-center gap-1 w-fit">
                        {getChangeIcon(entry.change_type)}
                        {entry.change_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {Number(entry.previous_stock).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      <span className={Number(entry.change_amount) >= 0 ? 'text-stock-normal' : 'text-destructive'}>
                        {Number(entry.change_amount) >= 0 ? '+' : ''}{Number(entry.change_amount).toLocaleString()}
                      </span>
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-medium">
                      {Number(entry.new_stock).toLocaleString()}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-muted-foreground text-sm">
                      {entry.notes || '-'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            No stock history available
          </div>
        )}
      </CardContent>
    </Card>
  );
}
