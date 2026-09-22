import { Search, Download, FileText, Printer, Loader2, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { StockStatusFilter } from '@/hooks/useStockPerformance';

interface Props {
  category: string;
  onCategoryChange: (v: string) => void;
  supplierId: string;
  onSupplierChange: (v: string) => void;
  suppliers: { id: string; name: string }[];
  stockStatus: StockStatusFilter;
  onStockStatusChange: (v: StockStatusFilter) => void;
  search: string;
  onSearchChange: (v: string) => void;
  onExportCSV: () => void;
  onExportPDF: () => void;
  onPrint: () => void;
  busy: 'csv' | 'pdf' | 'print' | null;
}

export function PerformanceControlBar(props: Props) {
  const filterControls = (
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Category</Label>
        <Select value={props.category} onValueChange={props.onCategoryChange}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="sellable">Sellable</SelectItem>
            <SelectItem value="consumable">Consumable</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Supplier</Label>
        <Select value={props.supplierId} onValueChange={props.onSupplierChange}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Suppliers</SelectItem>
            {props.suppliers.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Stock Status</Label>
        <Select value={props.stockStatus} onValueChange={(v) => props.onStockStatusChange(v as StockStatusFilter)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="fast">Fast-Moving</SelectItem>
            <SelectItem value="slow">Slow-Moving / Dead Stock</SelectItem>
            <SelectItem value="low">Low Stock Alert</SelectItem>
            <SelectItem value="out">Out of Stock</SelectItem>
            <SelectItem value="expired">Expired Items</SelectItem>
            <SelectItem value="almost_expired">Almost Expired Items</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  const actionButton = (
    label: string,
    icon: React.ReactNode,
    onClick: () => void,
    loading: boolean,
  ) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button variant="outline" size="sm" onClick={onClick} disabled={!!props.busy} className="gap-2">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
          <span className="hidden sm:inline">{label}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );

  return (
    <div className="no-print rounded-lg border bg-card p-4 shadow-sm space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="ml-auto flex items-center gap-2">
          {actionButton('Export CSV', <Download className="h-4 w-4" />, props.onExportCSV, props.busy === 'csv')}
          {actionButton('Export PDF', <FileText className="h-4 w-4" />, props.onExportPDF, props.busy === 'pdf')}
          {actionButton('Print Report', <Printer className="h-4 w-4" />, props.onPrint, props.busy === 'print')}
        </div>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={props.search}
            onChange={(e) => props.onSearchChange(e.target.value)}
            placeholder="Search product name, SKU or barcode..."
            className="pl-9"
          />
        </div>

        {/* Desktop filters */}
        <div className="hidden lg:block lg:w-[600px]">{filterControls}</div>

        {/* Mobile filter drawer */}
        <div className="lg:hidden">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="w-full gap-2">
                <SlidersHorizontal className="h-4 w-4" /> Filters
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[calc(100vw-3rem)] max-w-sm" align="start">
              {filterControls}
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  );
}