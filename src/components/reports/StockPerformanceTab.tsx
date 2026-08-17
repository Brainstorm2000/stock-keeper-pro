import { useMemo, useState } from 'react';
import {
  format, startOfDay, endOfDay, subDays, startOfMonth, endOfMonth,
} from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { TablePagination } from '@/components/ui/table-pagination';
import { useToast } from '@/hooks/use-toast';
import { useDebounce } from '@/hooks/useDebounce';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useOrganization } from '@/hooks/useOrganization';
import { useAuth } from '@/lib/auth';
import { exportToCSV, exportToPDF } from '@/lib/export-utils';
import { formatCurrency } from '@/lib/currency';
import {
  fetchAllPerformanceRows,
  usePerformanceRows,
  usePerformanceSummary,
  type PerformanceFilters,
  type PerformanceRow,
  type PerformanceSortKey,
  type StockStatusFilter,
} from '@/hooks/useStockPerformance';
import { PerformanceControlBar, type DatePreset } from './PerformanceControlBar';
import { PerformanceKPICards } from './PerformanceKPICards';
import { StockPerformanceTable, statusLabel, velocityLabel } from './StockPerformanceTable';
import { PurchaseDialog } from '@/components/purchases/PurchaseDialog';

interface Props {
  selectedBranch: string;
  branches: { id: string; name: string }[];
}

const FAST_MOVER_THRESHOLD = Number(import.meta.env.VITE_FAST_MOVER_THRESHOLD ?? 1) || 1;

function rangeForPreset(preset: DatePreset, current: { from: Date; to: Date }) {
  const now = new Date();
  switch (preset) {
    case 'today':
      return { from: startOfDay(now), to: endOfDay(now) };
    case 'yesterday':
      return { from: startOfDay(subDays(now, 1)), to: endOfDay(subDays(now, 1)) };
    case 'last7':
      return { from: startOfDay(subDays(now, 6)), to: endOfDay(now) };
    case 'month':
      return { from: startOfMonth(now), to: endOfMonth(now) };
    default:
      return current;
  }
}

export function StockPerformanceTab({ selectedBranch, branches }: Props) {
  const { toast } = useToast();
  const { organizationId } = useAuth();
  const { data: org } = useOrganization();
  const { data: suppliers = [] } = useSuppliers();

  const [preset, setPreset] = useState<DatePreset>('month');
  const [range, setRange] = useState(() => rangeForPreset('month', { from: new Date(), to: new Date() }));
  const [category, setCategory] = useState('all');
  const [supplierId, setSupplierId] = useState('all');
  const [stockStatus, setStockStatus] = useState<StockStatusFilter>('all');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<PerformanceSortKey>('product_name');
  const [dir, setDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [busy, setBusy] = useState<'csv' | 'pdf' | 'print' | null>(null);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [printRows, setPrintRows] = useState<PerformanceRow[]>([]);

  const debouncedSearch = useDebounce(search, 400);

  const filters: PerformanceFilters = useMemo(() => ({
    from: range.from,
    to: range.to,
    branchId: selectedBranch,
    category,
    supplierId,
    stockStatus,
    search: debouncedSearch,
    fastThreshold: FAST_MOVER_THRESHOLD,
  }), [range, selectedBranch, category, supplierId, stockStatus, debouncedSearch]);

  const rowsQuery = usePerformanceRows(filters, sort, dir, page, pageSize);
  const summaryQuery = usePerformanceSummary(filters);

  const rows = rowsQuery.data?.rows ?? [];
  const totalCount = rowsQuery.data?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const periodLabel = `${format(range.from, 'MMM dd, yyyy')} – ${format(range.to, 'MMM dd, yyyy')}`;
  const branchLabel = selectedBranch === 'all'
    ? 'All Branches'
    : branches.find((b) => b.id === selectedBranch)?.name ?? 'Branch';
  const filterSummary = [
    `Branch: ${branchLabel}`,
    `Category: ${category === 'all' ? 'All' : category}`,
    `Supplier: ${supplierId === 'all' ? 'All' : suppliers.find((s) => s.id === supplierId)?.name ?? 'All'}`,
    `Stock status: ${stockStatus === 'all' ? 'All' : stockStatus}`,
    debouncedSearch ? `Search: "${debouncedSearch}"` : null,
  ].filter(Boolean).join(' · ');

  const handleSort = (key: PerformanceSortKey) => {
    if (sort === key) setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSort(key);
      setDir('asc');
    }
    setPage(1);
  };

  const resetPage = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setPage(1);
  };

  const loadAll = async () => {
    if (!organizationId) throw new Error('No organization');
    return fetchAllPerformanceRows(organizationId, filters, sort, dir);
  };

  const handleExportCSV = async () => {
    setBusy('csv');
    try {
      const all = await loadAll();
      if (!all.length) {
        toast({ title: 'Nothing to export', description: 'No rows match the current filters.' });
        return;
      }
      exportToCSV(all.map((r) => ({
        'Product Name': r.product_name,
        SKU: r.sku || '',
        Barcode: r.sku || '',
        Category: r.category,
        'Initial Stock': Number(r.opening_stock),
        Received: Number(r.received),
        'Units Sold': Number(r.units_sold),
        'Current Stock': Number(r.current_stock),
        'Stock Status': statusLabel(r.stock_status),
        'Unit Cost': Number(r.cost_price),
        'Unit Selling Price': Number(r.selling_price),
        'Inventory Value': Number(r.inventory_value),
        Revenue: Number(r.revenue),
        COGS: Number(r.cogs),
        'Gross Profit': Number(r.gross_profit),
        'Profit Margin %': Number(r.margin),
        Velocity: velocityLabel(r.velocity),
      })), 'stock_sales_performance');
      toast({ title: 'CSV exported', description: `${all.length} rows exported.` });
    } catch (e) {
      toast({ title: 'Export failed', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  const handleExportPDF = async () => {
    setBusy('pdf');
    try {
      const all = await loadAll();
      const s = summaryQuery.data;
      exportToPDF(
        'Stock & Sales Performance Report',
        ['Product', 'SKU', 'Initial', 'Recv', 'Sold', 'On Hand', 'Status', 'Inv. Value', 'Revenue', 'COGS', 'Profit', 'Margin', 'Velocity'],
        all.map((r) => [
          r.product_name, r.sku || '-', String(Number(r.opening_stock)), String(Number(r.received)),
          String(Number(r.units_sold)), String(Number(r.current_stock)), statusLabel(r.stock_status),
          formatCurrency(Number(r.inventory_value)), formatCurrency(Number(r.revenue)),
          formatCurrency(Number(r.cogs)), formatCurrency(Number(r.gross_profit)),
          `${Number(r.margin).toFixed(1)}%`, velocityLabel(r.velocity),
        ]),
        {
          'Period': periodLabel,
          'Filters': filterSummary,
          'Inventory Value (Cost)': formatCurrency(Number(s?.inventory_cost_value ?? 0)),
          'Gross Revenue': formatCurrency(Number(s?.gross_revenue ?? 0)),
          'Gross Profit': formatCurrency(Number(s?.gross_profit ?? 0)),
          'Avg Margin': `${Number(s?.avg_margin ?? 0).toFixed(1)}%`,
          'Active SKUs': String(Number(s?.active_skus ?? 0)),
          'Low / Out of Stock': `${Number(s?.low_stock_items ?? 0)} / ${Number(s?.out_of_stock_items ?? 0)}`,
        },
        org || undefined,
      );
      toast({ title: 'PDF ready', description: 'Use your browser dialog to save the report.' });
    } catch (e) {
      toast({ title: 'Export failed', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  const handlePrint = async () => {
    setBusy('print');
    try {
      const all = await loadAll();
      setPrintRows(all);
      await new Promise((r) => setTimeout(r, 150));
      window.print();
      setPrintRows([]);
    } catch (e) {
      toast({ title: 'Print failed', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setBusy(null);
    }
  };

  const handleRestock = (row: PerformanceRow) => {
    setPurchaseOpen(true);
    toast({
      title: `Restock ${row.product_name}`,
      description: `On hand ${Number(row.current_stock)} · min ${Number(row.low_threshold)} · suggested order ${Math.max(
        Number(row.low_threshold) * 2 - Number(row.current_stock),
        1,
      )}${row.supplier_name ? ` · supplier ${row.supplier_name}` : ''}`,
    });
  };

  const s = summaryQuery.data;

  return (
    <div className="space-y-5 print-report">
      {/* Print-only header */}
      <div className="print-only space-y-1 text-center">
        <h1 className="text-xl font-bold">{org?.name ?? 'Company'}</h1>
        <h2 className="text-base font-semibold">Stock &amp; Sales Performance Report</h2>
        <p className="text-xs">Reporting Period: {periodLabel}</p>
        <p className="text-xs">Generated: {format(new Date(), 'PPP pp')}</p>
        <p className="text-xs">{filterSummary}</p>
      </div>

      <PerformanceControlBar
        preset={preset}
        onPresetChange={(p) => {
          setPreset(p);
          setRange(rangeForPreset(p, range));
          setPage(1);
        }}
        from={range.from}
        to={range.to}
        onCustomRangeChange={({ from, to }) => {
          setRange({ from: startOfDay(from), to: endOfDay(to) });
          setPage(1);
        }}
        category={category}
        onCategoryChange={resetPage(setCategory)}
        supplierId={supplierId}
        onSupplierChange={resetPage(setSupplierId)}
        suppliers={suppliers}
        stockStatus={stockStatus}
        onStockStatusChange={resetPage(setStockStatus)}
        search={search}
        onSearchChange={resetPage(setSearch)}
        onExportCSV={handleExportCSV}
        onExportPDF={handleExportPDF}
        onPrint={handlePrint}
        busy={busy}
      />

      <PerformanceKPICards summary={s} loading={summaryQuery.isLoading} />

      <Card className="shadow-sm">
        <CardContent className="p-0">
          <div className="max-h-[65vh] overflow-auto print-scroll">
            <StockPerformanceTable
              rows={printRows.length ? printRows : rows}
              loading={rowsQuery.isLoading}
              error={rowsQuery.error as Error | null}
              sort={sort}
              dir={dir}
              onSort={handleSort}
              onRestock={handleRestock}
            />
          </div>
          <div className="no-print border-t p-3">
            <TablePagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={totalCount}
              pageSize={pageSize}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setPage(1);
              }}
            />
          </div>
        </CardContent>
      </Card>

      <PurchaseDialog open={purchaseOpen} onOpenChange={setPurchaseOpen} />
    </div>
  );
}