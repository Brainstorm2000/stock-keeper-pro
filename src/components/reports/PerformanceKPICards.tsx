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

  const s = summary!;
  const num = (n: number) => Number(n || 0).toLocaleString('en-NG');

  const cards = [
    {
      title: 'Stock Valuation',
      icon: Warehouse,
      headline: formatCurrency(Number(s.inventory_cost_value || 0)),
      caption: 'Inventory value at cost',
      metrics: [
        { label: 'Potential retail value', value: formatCurrency(Number(s.potential_retail_value || 0)) },
        { label: 'Potential gross value', value: formatCurrency(Number(s.potential_gross_value || 0)), tone: 'strong' as const },
      ],
    },
    {
      title: 'Sales & Volume',
      icon: ShoppingCart,
      headline: formatCurrency(Number(s.gross_revenue || 0)),
      caption: 'Gross revenue for period',
      metrics: [
        { label: 'Units sold', value: num(Number(s.units_sold || 0)) },
        { label: 'Transactions', value: num(Number(s.transactions || 0)) },
      ],
    },
    {
      title: 'Profitability',
      icon: TrendingUp,
      headline: formatCurrency(Number(s.gross_profit || 0)),
      caption: 'Gross profit for period',
      metrics: [
        { label: 'Total COGS', value: formatCurrency(Number(s.total_cogs || 0)) },
        { label: 'Average gross margin', value: `${Number(s.avg_margin || 0).toFixed(1)}%`, tone: 'strong' as const },
      ],
    },
    {
      title: 'Stock Health',
      icon: AlertTriangle,
      headline: num(Number(s.active_skus || 0)),
      caption: 'Active SKUs in scope',
      metrics: [
        { label: 'Low stock items', value: num(Number(s.low_stock_items || 0)), tone: 'warn' as const },
        { label: 'Out of stock items', value: num(Number(s.out_of_stock_items || 0)), tone: 'danger' as const },
      ],
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4 print-kpis">
      {cards.map((c) => (
        <Card key={c.title} className="shadow-sm">
          <CardContent className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">{c.title}</span>
              <c.icon className="h-4 w-4 text-primary" />
            </div>
            <div>
              <div className="text-2xl font-bold tracking-tight">{c.headline}</div>
              <div className="text-xs text-muted-foreground">{c.caption}</div>
            </div>
            <div className="space-y-1 border-t pt-3">
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