import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Warehouse, ShoppingCart, TrendingUp, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '@/lib/currency';
import type { PerformanceSummary } from '@/hooks/useStockPerformance';

interface Props {
  summary?: PerformanceSummary;
  loading: boolean;
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: 'muted' | 'strong' | 'warn' | 'danger' }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span
        className={
          tone === 'strong'
            ? 'text-sm font-semibold'
            : tone === 'warn'
              ? 'text-sm font-semibold text-amber-600 dark:text-amber-500'
              : tone === 'danger'
                ? 'text-sm font-semibold text-destructive'
                : 'text-sm font-medium'
        }
      >
        {value}
      </span>
    </div>
  );
}

export function PerformanceKPICards({ summary, loading }: Props) {
  if (loading && !summary) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}><CardContent className="p-5 space-y-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-7 w-24" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
          </CardContent></Card>
        ))}
      </div>
    );
  }

  const s: PerformanceSummary = summary ?? {
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
  };
  const num = (n: number) => Number(n || 0).toLocaleString('en-NG');

  const cards = [
    {
      title: 'Executive Summary',
      icon: Warehouse,
      metrics: [
        { label: 'Current Inventory Value', value: formatCurrency(Number(s.inventory_cost_value || 0)), tone: 'strong' as const },
        { label: 'Potential Retail Value', value: formatCurrency(Number(s.potential_retail_value || 0)) },
        { label: 'Total Sales Revenue', value: formatCurrency(Number(s.gross_revenue || 0)) },
        { label: 'Total Cost of Goods Sold (COGS)', value: formatCurrency(Number(s.total_cogs || 0)) },
        { label: 'Total Gross Profit', value: formatCurrency(Number(s.gross_profit || 0)), tone: 'strong' as const },
        { label: 'Average Profit Margin', value: `${Number(s.avg_margin || 0).toFixed(1)}%` },
        { label: 'Low Stock Items', value: num(Number(s.low_stock_items || 0)), tone: 'warn' as const },
        { label: 'Out of Stock Items', value: num(Number(s.out_of_stock_items || 0)), tone: 'danger' as const },
        { label: 'Expired Items', value: num(Number(s.expired_items || 0)), tone: 'danger' as const },
        { label: 'Almost Expired Items', value: num(Number(s.almost_expired_items || 0)), tone: 'warn' as const },
      ],
    },
  ];

  return (
    <div className="grid gap-4 print-kpis">
      {cards.map((c) => (
        <Card key={c.title} className="shadow-sm">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">{c.title}</span>
              <c.icon className="h-4 w-4 text-primary" />
            </div>
            <div className="grid gap-x-8 gap-y-2 border-t pt-3 sm:grid-cols-2 lg:grid-cols-3">
              {c.metrics.map((m) => (
                <Metric key={m.label} label={m.label} value={m.value} tone={m.tone} />
              ))}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}