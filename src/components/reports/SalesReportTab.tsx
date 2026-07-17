import { useMemo } from 'react';
import { format, parseISO, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval, isSameDay, isSameWeek, isSameMonth } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, FileText, TrendingUp, DollarSign, ShoppingCart, CreditCard, Users, Medal } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { formatCurrency } from '@/lib/currency';
import { exportToCSV, exportToPDF } from '@/lib/export-utils';
import { DateRange } from '@/components/reports/DateRangeFilter';
import { useOrganization } from '@/hooks/useOrganization';
import { usePaymentMethods } from '@/hooks/usePaymentMethods';

interface SalesReportTabProps {
  sales: any[];
  saleItems: any[];
  dateRange: DateRange;
  branches: any[];
  selectedBranch: string;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export function SalesReportTab({ sales, saleItems, dateRange, branches, selectedBranch }: SalesReportTabProps) {
  const { data: org } = useOrganization();
  const { data: orgPaymentMethods = [] } = usePaymentMethods();
  const methodById = useMemo(
    () => Object.fromEntries(orgPaymentMethods.map((m) => [m.id, m])),
    [orgPaymentMethods]
  );
  const filteredSales = useMemo(() => {
    return sales.filter(s => {
      const d = new Date(s.created_at);
      const inRange = d >= dateRange.from && d <= dateRange.to;
      const inBranch = selectedBranch === 'all' || s.branch_id === selectedBranch;
      return inRange && inBranch && s.status === 'completed';
    });
  }, [sales, dateRange, selectedBranch]);

  const totalRevenue = filteredSales.reduce((s, sale) => s + Number(sale.total_amount || 0), 0);
  const totalDiscount = filteredSales.reduce((s, sale) => s + Number(sale.discount_amount || 0), 0);
  const avgOrderValue = filteredSales.length ? totalRevenue / filteredSales.length : 0;

  // Revenue over time
  const revenueByDay = useMemo(() => {
    const days = eachDayOfInterval({ start: dateRange.from, end: dateRange.to });
    return days.map(day => {
      const daySales = filteredSales.filter(s => isSameDay(new Date(s.created_at), day));
      return {
        date: format(day, 'MMM dd'),
        revenue: daySales.reduce((sum, s) => sum + Number(s.total_amount || 0), 0),
        count: daySales.length,
      };
    });
  }, [filteredSales, dateRange]);

  // Payment method breakdown
  const paymentBreakdown = useMemo(() => {
    // Group by a normalized key so the same method never appears twice
    // (e.g. legacy enum 'cash' vs a custom method named 'Cash').
    const map: Record<string, { name: string; value: number }> = {};
    const displayLabel = (methodId: string | null | undefined, fallbackEnum: string) => {
      if (methodId && methodById[methodId]) return methodById[methodId].name;
      const enumMatch = (fallbackEnum || 'cash').toLowerCase();
      const byEnum = orgPaymentMethods.find(
        (m) => m.name.toLowerCase().replace(/\s+/g, '_') === enumMatch,
      );
      if (byEnum) return byEnum.name;
      return (fallbackEnum || 'cash')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
    };
    const add = (label: string, amount: number) => {
      const key = label.trim().toLowerCase();
      if (!map[key]) map[key] = { name: label.trim(), value: 0 };
      map[key].value += amount;
    };
    filteredSales.forEach((s) => {
      if (Array.isArray(s.payment_details) && s.payment_details.length > 0) {
        s.payment_details.forEach((pd: any) => {
          add(displayLabel(pd.method_id, pd.method || s.payment_method), Number(pd.amount || 0));
        });
      } else {
        add(displayLabel(s.payment_method_id, s.payment_method), Number(s.total_amount || 0));
      }
    });
    return Object.values(map).filter((x) => x.value > 0);
  }, [filteredSales, methodById]);

  // Top products
  const topProducts = useMemo(() => {
    const saleIds = new Set(filteredSales.map(s => s.id));
    const items = saleItems.filter(si => saleIds.has(si.sale_id));
    const map: Record<string, { name: string; qty: number; revenue: number }> = {};
    items.forEach(item => {
      const name = item.products?.name || 'Unknown';
      if (!map[name]) map[name] = { name, qty: 0, revenue: 0 };
      map[name].qty += Number(item.quantity || 0);
      map[name].revenue += Number(item.total_price || 0);
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  }, [filteredSales, saleItems]);

  // Branch breakdown
  const branchBreakdown = useMemo(() => {
    const map: Record<string, { name: string; revenue: number; count: number }> = {};
    filteredSales.forEach(s => {
      const branch = branches.find(b => b.id === s.branch_id);
      const name = branch?.name || 'Unknown';
      if (!map[name]) map[name] = { name, revenue: 0, count: 0 };
      map[name].revenue += Number(s.total_amount || 0);
      map[name].count += 1;
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue);
  }, [filteredSales, branches]);

  // Top customers
  const topCustomers = useMemo(() => {
    const map: Record<string, { name: string; revenue: number; orders: number }> = {};
    filteredSales.forEach((s) => {
      const name = s.customer_name?.trim() || 'Walk-in';
      if (!map[name]) map[name] = { name, revenue: 0, orders: 0 };
      map[name].revenue += Number(s.total_amount || 0);
      map[name].orders += 1;
    });
    return Object.values(map).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  }, [filteredSales]);

  const handleExportCSV = () => {
    exportToCSV(filteredSales.map(s => ({
      'Sale #': s.sale_number,
      Date: format(new Date(s.created_at), 'yyyy-MM-dd HH:mm'),
      Customer: s.customer_name || '-',
      Subtotal: s.subtotal,
      Discount: s.discount_amount,
      Tax: s.tax_amount,
      Total: s.total_amount,
      Payment: s.payment_method,
      Branch: branches.find(b => b.id === s.branch_id)?.name || '-',
    })), 'sales_report');
  };

  const handleExportPDF = () => {
    exportToPDF('Sales Report', ['Sale #', 'Date', 'Customer', 'Total', 'Payment'],
      filteredSales.map(s => [s.sale_number, format(new Date(s.created_at), 'MMM dd, yyyy'), s.customer_name || '-', formatCurrency(s.total_amount), s.payment_method]),
      { 'Total Revenue': formatCurrency(totalRevenue), 'Total Sales': String(filteredSales.length), 'Avg. Order Value': formatCurrency(avgOrderValue) },
      org || undefined
    );
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><DollarSign className="h-3.5 w-3.5" /> Total Revenue</div>
          <p className="text-xl font-bold">{formatCurrency(totalRevenue)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><ShoppingCart className="h-3.5 w-3.5" /> Total Sales</div>
          <p className="text-xl font-bold">{filteredSales.length}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><TrendingUp className="h-3.5 w-3.5" /> Avg. Order Value</div>
          <p className="text-xl font-bold">{formatCurrency(avgOrderValue)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><CreditCard className="h-3.5 w-3.5" /> Total Discounts</div>
          <p className="text-xl font-bold">{formatCurrency(totalDiscount)}</p>
        </CardContent></Card>
      </div>

      {/* Export Buttons */}
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={handleExportCSV}><Download className="h-4 w-4 mr-1" /> CSV</Button>
        <Button variant="outline" size="sm" onClick={handleExportPDF}><FileText className="h-4 w-4 mr-1" /> PDF</Button>
      </div>

      {/* Revenue Trend Chart */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Revenue Trend</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={revenueByDay}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
              <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Payment Method Pie */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Payment Methods</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              {(() => {
                const total = paymentBreakdown.reduce((s, x) => s + Number(x.value || 0), 0);
                return (
                  <PieChart>
                    <Pie
                      data={paymentBreakdown}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={90}
                    >
                      {paymentBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip
                      formatter={(v: number, name: string) => {
                        const pct = total > 0 ? ((Number(v) / total) * 100).toFixed(1) : '0';
                        return [`${formatCurrency(v)} (${pct}%)`, name];
                      }}
                    />
                    <Legend />
                  </PieChart>
                );
              })()}
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Branch Breakdown */}
        <Card>
          <CardHeader><CardTitle className="text-sm">Sales by Branch</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={branchBreakdown} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={100} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Bar dataKey="revenue" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Top Products Table */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Top Selling Products</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Qty Sold</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topProducts.map(p => (
                <TableRow key={p.name}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell className="text-right">{p.qty}</TableCell>
                  <TableCell className="text-right">{formatCurrency(p.revenue)}</TableCell>
                </TableRow>
              ))}
              {!topProducts.length && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">No sales data</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Top Customers Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="h-4 w-4" /> Top Customers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead className="text-right">Orders</TableHead>
                <TableHead className="text-right">Total Spent</TableHead>
                <TableHead className="text-right">Avg. Order</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topCustomers.map((c, index) => (
                <TableRow key={c.name}>
                  <TableCell className="font-medium">
                    
                    {index < 3 ? (
                      <span className="inline-flex items-center gap-2">
                        <Medal
                          className={`h-4 w-4 ${
                            index === 0
                              ? 'text-amber-400'
                              : index === 1
                                ? 'text-slate-400'
                                : 'text-orange-600'
                          }`} />
                    {c.name}    
                      </span>
                    ) : (
                      c.name
                    )}
                  </TableCell>
                  <TableCell className="text-right">{c.orders}</TableCell>
                  <TableCell className="text-right">{formatCurrency(c.revenue)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(c.revenue / c.orders)}</TableCell>
                </TableRow>
              ))}
              {!topCustomers.length && (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No customer data
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
