import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

export type StockStatusFilter = 'all' | 'fast' | 'slow' | 'low' | 'out' | 'expired' | 'almost_expired';

export interface PerformanceFilters {
  from: Date;
  to: Date;
  branchId?: string | null;
  category?: string | null;
  supplierId?: string | null;
  stockStatus: StockStatusFilter;
  search?: string;
  fastThreshold: number;
}

export interface PerformanceRow {
  product_id: string;
  product_name: string;
  sku: string | null;
  category: string;
  supplier_name: string | null;
  branch_name: string | null;
  opening_stock: number;
  received: number;
  units_sold: number;
  current_stock: number;
  low_threshold: number;
  out_threshold: number;
  cost_price: number;
  selling_price: number;
  inventory_value: number;
  retail_value: number;
  revenue: number;
  cogs: number;
  gross_profit: number;
  margin: number;
  stock_status: 'normal' | 'low' | 'out' | 'expired' | 'almost_expired';
  velocity: 'fast' | 'slow';
  total_count?: number;
}

export interface PerformanceSummary {
  inventory_cost_value: number;
  potential_retail_value: number;
  potential_gross_value: number;
  units_sold: number;
  gross_revenue: number;
  total_cogs: number;
  gross_profit: number;
  avg_margin: number;
  transactions: number;
  active_skus: number;
  low_stock_items: number;
  out_of_stock_items: number;
  expired_items: number;
  almost_expired_items: number;
  fast_movers: number;
  slow_movers: number;
}

export type PerformanceSortKey =
  | 'product_name'
  | 'category'
  | 'stock_status'
  | 'velocity'
  | 'opening_stock'
  | 'received'
  | 'units_sold'
  | 'current_stock'
  | 'cost_price'
  | 'selling_price'
  | 'inventory_value'
  | 'revenue'
  | 'cogs'
  | 'gross_profit'
  | 'margin';

function baseArgs(orgId: string, f: PerformanceFilters) {
  return {
    _org_id: orgId,
    _from: f.from.toISOString(),
    _to: f.to.toISOString(),
    _branch_id: f.branchId && f.branchId !== 'all' ? f.branchId : null,
    _category: f.category && f.category !== 'all' ? f.category : null,
    _supplier_id: f.supplierId && f.supplierId !== 'all' ? f.supplierId : null,
    _stock_status: f.stockStatus ?? 'all',
    _search: f.search?.trim() || null,
    _fast_threshold: f.fastThreshold,
  };
}

const rpc = (name: string, args: Record<string, unknown>) =>
  (supabase as unknown as {
    rpc: (n: string, a: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
  }).rpc(name, args);

export function usePerformanceRows(
  filters: PerformanceFilters,
  sort: PerformanceSortKey,
  dir: 'asc' | 'desc',
  page: number,
  pageSize: number,
) {
  const { organizationId } = useAuth();

  return useQuery({
    queryKey: ['stock-performance-rows', organizationId, filters, sort, dir, page, pageSize],
    enabled: !!organizationId,
    placeholderData: (prev) => prev,
    queryFn: async () => {
      const { data, error } = await rpc('stock_sales_performance_rows', {
        ...baseArgs(organizationId as string, filters),
        _sort: sort,
        _dir: dir,
        _limit: pageSize,
        _offset: (page - 1) * pageSize,
      });
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as PerformanceRow[];
      return {
        rows,
        totalCount: Number(rows[0]?.total_count ?? 0),
      };
    },
  });
}

export function usePerformanceSummary(filters: PerformanceFilters) {
  const { organizationId } = useAuth();

  return useQuery({
    queryKey: ['stock-performance-summary', organizationId, filters],
    enabled: !!organizationId,
    placeholderData: (prev) => prev,
    queryFn: async () => {
      const { data, error } = await rpc('stock_sales_performance_summary', baseArgs(organizationId as string, filters));
      if (error) throw new Error(error.message);
      const row = ((data ?? []) as PerformanceSummary[])[0];
      return (
        row ?? {
          inventory_cost_value: 0,
          potential_retail_value: 0,
          potential_gross_value: 0,
          units_sold: 0,
          gross_revenue: 0,
          total_cogs: 0,
          gross_profit: 0,
          avg_margin: 0,
          transactions: 0,
          active_skus: 0,
          low_stock_items: 0,
          out_of_stock_items: 0,
          expired_items: 0,
          almost_expired_items: 0,
          fast_movers: 0,
          slow_movers: 0,
        }
      );
    },
  });
}

/** Fetches every filtered row (no pagination) for exports/printing. */
export async function fetchAllPerformanceRows(
  organizationId: string,
  filters: PerformanceFilters,
  sort: PerformanceSortKey,
  dir: 'asc' | 'desc',
): Promise<PerformanceRow[]> {
  const pageSize = 1000;
  const all: PerformanceRow[] = [];

  for (let page = 0; page < 50; page++) {
    const { data, error } = await rpc('stock_sales_performance_rows', {
      ...baseArgs(organizationId, filters),
      _sort: sort,
      _dir: dir,
      _limit: pageSize,
      _offset: page * pageSize,
    });
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as PerformanceRow[];
    all.push(...rows);
    if (rows.length < pageSize) break;
  }

  return all;
}