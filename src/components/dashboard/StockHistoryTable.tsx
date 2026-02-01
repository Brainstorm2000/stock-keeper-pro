import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { ArrowUp, ArrowDown, RefreshCw, Package, Search, CalendarIcon, X } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
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
    case 'sale':
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
    case 'sale':
      return 'destructive';
    case 'adjustment':
      return 'secondary';
    default:
      return 'outline';
  }
}

export function StockHistoryTable({ productId, limit = 100 }: StockHistoryTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  
  const { data: history, isLoading } = useStockHistory(
    productId, 
    limit, 
    categoryFilter !== 'all' ? categoryFilter as 'sellable' | 'consumable' : undefined
  );

  const filteredHistory = useMemo(() => {
    if (!history) return [];
    
    return history.filter((entry) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const productName = entry.products?.name?.toLowerCase() || '';
        const notes = entry.notes?.toLowerCase() || '';
        const changeType = entry.change_type.toLowerCase();
        
        if (!productName.includes(query) && !notes.includes(query) && !changeType.includes(query)) {
          return false;
        }
      }
      
      // Date filter
      const entryDate = new Date(entry.created_at);
      
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        if (entryDate < start) return false;
      }
      
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        if (entryDate > end) return false;
      }
      
      return true;
    });
  }, [history, searchQuery, startDate, endDate]);

  const clearFilters = () => {
    setSearchQuery('');
    setStartDate(undefined);
    setEndDate(undefined);
    setCategoryFilter('all');
  };

  const hasActiveFilters = searchQuery || startDate || endDate || categoryFilter !== 'all';

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
        <div className="flex flex-col gap-4">
          <CardTitle className="text-lg font-semibold">Recent Stock Changes</CardTitle>
          
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Category Filter */}
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="sellable">Sellable</SelectItem>
                <SelectItem value="consumable">Consumable</SelectItem>
              </SelectContent>
            </Select>
            
            {/* Search */}
            <div className="relative flex-1 min-w-[200px] max-w-[300px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products, notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            
            {/* Start Date */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[140px] justify-start text-left font-normal",
                    !startDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, "MMM d, yyyy") : "From"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={setStartDate}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            
            {/* End Date */}
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-[140px] justify-start text-left font-normal",
                    !endDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate ? format(endDate, "MMM d, yyyy") : "To"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={setEndDate}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
            
            {/* Clear Filters */}
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="mr-1 h-4 w-4" />
                Clear
              </Button>
            )}
          </div>
          
          {/* Results count */}
          {hasActiveFilters && (
            <p className="text-sm text-muted-foreground">
              Showing {filteredHistory.length} of {history?.length || 0} entries
            </p>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {filteredHistory.length > 0 ? (
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
                {filteredHistory.map((entry) => (
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
            {hasActiveFilters ? 'No entries match your filters' : 'No stock history available'}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
