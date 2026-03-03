import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { useWorkOrders } from '@/hooks/useWorkOrders';
import { useRawMaterials } from '@/hooks/useRawMaterials';
import { formatCurrency } from '@/lib/currency';
import { format, subDays, isAfter } from 'date-fns';

const CHART_COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-2, 160 60% 45%))',
  'hsl(var(--chart-3, 30 80% 55%))',
  'hsl(var(--chart-4, 280 65% 60%))',
  'hsl(var(--chart-5, 340 75% 55%))',
];

export function ProductionAnalyticsTab() {
  const { data: workOrders = [] } = useWorkOrders();
  const { data: materials = [] } = useRawMaterials();

  // Production trends (last 30 days)
  const trendData = useMemo(() => {
    const days = 30;
    const data: { date: string; produced: number; cost: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const day = subDays(new Date(), i);
      const dayStr = format(day, 'yyyy-MM-dd');
      const label = format(day, 'MMM d');
      const completed = workOrders.filter(
        (wo) => wo.status === 'completed' && wo.completed_at && format(new Date(wo.completed_at), 'yyyy-MM-dd') === dayStr
      );
      data.push({
        date: label,
        produced: completed.reduce((sum, wo) => sum + Number(wo.quantity), 0),
        cost: completed.reduce((sum, wo) => sum + Number(wo.total_cost), 0),
      });
    }
    return data;
  }, [workOrders]);

  // Top produced products
  const topProducts = useMemo(() => {
    const map = new Map<string, { name: string; quantity: number }>();
    workOrders
      .filter((wo) => wo.status === 'completed')
      .forEach((wo) => {
        const key = wo.product_id;
        const existing = map.get(key);
        if (existing) {
          existing.quantity += Number(wo.quantity);
        } else {
          map.set(key, { name: wo.products?.name || 'Unknown', quantity: Number(wo.quantity) });
        }
      });
    return Array.from(map.values()).sort((a, b) => b.quantity - a.quantity).slice(0, 5);
  }, [workOrders]);

  // Material usage breakdown
  const materialUsage = useMemo(() => {
    const map = new Map<string, { name: string; value: number }>();
    workOrders
      .filter((wo) => ['approved', 'completed', 'in_progress'].includes(wo.status))
      .forEach((wo) => {
        wo.work_order_materials?.forEach((mat) => {
          const key = mat.raw_material_id;
          const existing = map.get(key);
          const qty = Number(mat.quantity_required);
          if (existing) {
            existing.value += qty;
          } else {
            map.set(key, { name: mat.raw_materials?.name || 'Unknown', value: qty });
          }
        });
      });
    return Array.from(map.values()).sort((a, b) => b.value - a.value).slice(0, 6);
  }, [workOrders]);

  // Low stock materials
  const lowStockMaterials = materials.filter((m) => m.current_stock <= m.low_stock_threshold);

  // Summary stats
  const totalProduced = workOrders.filter((w) => w.status === 'completed').reduce((s, w) => s + Number(w.quantity), 0);
  const totalCost = workOrders.filter((w) => w.status === 'completed').reduce((s, w) => s + Number(w.total_cost), 0);

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Total Produced</p><p className="text-2xl font-bold">{totalProduced.toLocaleString()}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Total Production Cost</p><p className="text-2xl font-bold">{formatCurrency(totalCost)}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Work Orders</p><p className="text-2xl font-bold">{workOrders.length}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Low Stock Materials</p><p className="text-2xl font-bold text-destructive">{lowStockMaterials.length}</p></CardContent></Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Production Trends */}
        <Card>
          <CardHeader><CardTitle className="text-base">Production Trends (30 Days)</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} interval="preserveStartEnd" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--foreground))' }} />
                <Legend />
                <Line type="monotone" dataKey="produced" name="Units Produced" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Top Products */}
        <Card>
          <CardHeader><CardTitle className="text-base">Top Produced Products</CardTitle></CardHeader>
          <CardContent>
            {topProducts.length === 0 ? (
              <p className="text-center text-muted-foreground py-12">No completed work orders yet</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={topProducts} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="name" type="category" width={120} stroke="hsl(var(--muted-foreground))" tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--foreground))' }} />
                  <Bar dataKey="quantity" name="Quantity" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Material Usage Pie */}
        <Card>
          <CardHeader><CardTitle className="text-base">Material Usage Breakdown</CardTitle></CardHeader>
          <CardContent>
            {materialUsage.length === 0 ? (
              <p className="text-center text-muted-foreground py-12">No material usage data</p>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={materialUsage} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={(entry) => entry.name}>
                    {materialUsage.map((_, idx) => <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--foreground))' }} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Low Stock Alerts */}
        <Card>
          <CardHeader><CardTitle className="text-base">Low Stock Alerts</CardTitle></CardHeader>
          <CardContent>
            {lowStockMaterials.length === 0 ? (
              <p className="text-center text-muted-foreground py-12">All materials are sufficiently stocked</p>
            ) : (
              <div className="space-y-3 max-h-[280px] overflow-y-auto">
                {lowStockMaterials.map((m) => (
                  <div key={m.id} className="flex items-center justify-between p-3 rounded-lg bg-muted">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                      <span className="font-medium text-sm">{m.name}</span>
                    </div>
                    <div className="text-right">
                      <Badge variant={m.current_stock <= 0 ? 'destructive' : 'secondary'}>
                        {Number(m.current_stock)} / {Number(m.low_stock_threshold)}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
