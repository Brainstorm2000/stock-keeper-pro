import { useMemo } from 'react';
import { format, isSameDay, eachDayOfInterval } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, FileText, PackagePlus, DollarSign, Truck } from 'lucide-react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { formatCurrency } from '@/lib/currency';
import { exportToCSV, exportToPDF } from '@/lib/export-utils';
import { DateRange } from '@/components/reports/DateRangeFilter';

interface PurchaseReportTabProps {
  purchases: any[];
  dateRange: DateRange;
  branches: any[];
  selectedBranch: string;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export function PurchaseReportTab({ purchases, dateRange, branches, selectedBranch }: PurchaseReportTabProps) {
  const filteredPurchases = useMemo(() => {
    return purchases.filter(p => {
      const d = new Date(p.purchase_date);
      const inRange = d >= dateRange.from && d <= dateRange.to;
      const inBranch = selectedBranch === 'all' || p.branch_id === selectedBranch;
      return inRange && inBranch;
    });
  }, [purchases, dateRange, selectedBranch]);

  const totalAmount = filteredPurchases.reduce((s, p) => s + Number(p.total_amount || 0), 0);
  const totalPaid = filteredPurchases.reduce((s, p) => s + Number(p.amount_paid || 0), 0);
  const totalOutstanding = totalAmount - totalPaid;
  const avgPurchase = filteredPurchases.length ? totalAmount / filteredPurchases.length : 0;

  // Purchases over time
  const purchasesByDay = useMemo(() => {
    const days = eachDayOfInterval({ start: dateRange.from, end: dateRange.to });
    return days.map(day => {
      const dayPurchases = filteredPurchases.filter(p => isSameDay(new Date(p.purchase_date), day));
      return {
        date: format(day, 'MMM dd'),
        amount: dayPurchases.reduce((sum, p) => sum + Number(p.total_amount || 0), 0),
        count: dayPurchases.length,
      };
    });
  }, [filteredPurchases, dateRange]);

  // Payment status breakdown
  const statusBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    filteredPurchases.forEach(p => {
      const status = p.payment_status || 'pending';
      map[status] = (map[status] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [filteredPurchases]);

  // Top suppliers
  const topSuppliers = useMemo(() => {
    const map: Record<string, { name: string; amount: number; count: number }> = {};
    filteredPurchases.forEach(p => {
      const name = p.suppliers?.name || 'Unknown';
      if (!map[name]) map[name] = { name, amount: 0, count: 0 };
      map[name].amount += Number(p.total_amount || 0);
      map[name].count += 1;
    });
    return Object.values(map).sort((a, b) => b.amount - a.amount).slice(0, 10);
  }, [filteredPurchases]);

  const handleExportCSV = () => {
    exportToCSV(filteredPurchases.map(p => ({
      'PO #': p.purchase_number,
      Date: p.purchase_date,
      Supplier: p.suppliers?.name || '-',
      Total: p.total_amount,
      Paid: p.amount_paid,
      Status: p.payment_status,
      Branch: branches.find(b => b.id === p.branch_id)?.name || '-',
    })), 'purchase_report');
  };

  const handleExportPDF = () => {
    exportToPDF('Purchase Report', ['PO #', 'Date', 'Supplier', 'Total', 'Paid', 'Status'],
      filteredPurchases.map(p => [p.purchase_number, p.purchase_date, p.suppliers?.name || '-', formatCurrency(p.total_amount), formatCurrency(p.amount_paid), p.payment_status]),
      { 'Total Purchases': formatCurrency(totalAmount), 'Total Paid': formatCurrency(totalPaid), 'Outstanding': formatCurrency(totalOutstanding) }
    );
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><DollarSign className="h-3.5 w-3.5" /> Total Purchases</div>
          <p className="text-xl font-bold">{formatCurrency(totalAmount)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><PackagePlus className="h-3.5 w-3.5" /> Orders</div>
          <p className="text-xl font-bold">{filteredPurchases.length}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <div className="text-muted-foreground text-xs mb-1">Total Paid</div>
          <p className="text-xl font-bold">{formatCurrency(totalPaid)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><Truck className="h-3.5 w-3.5" /> Outstanding</div>
          <p className="text-xl font-bold text-destructive">{formatCurrency(totalOutstanding)}</p>
        </CardContent></Card>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={handleExportCSV}><Download className="h-4 w-4 mr-1" /> CSV</Button>
        <Button variant="outline" size="sm" onClick={handleExportPDF}><FileText className="h-4 w-4 mr-1" /> PDF</Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Purchase Trend</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={purchasesByDay}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
              <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Bar dataKey="amount" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-sm">Payment Status</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={statusBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, value }) => `${name}: ${value}`}>
                  {statusBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Top Suppliers</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Supplier</TableHead>
                  <TableHead className="text-right">Orders</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topSuppliers.map(s => (
                  <TableRow key={s.name}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="text-right">{s.count}</TableCell>
                    <TableCell className="text-right">{formatCurrency(s.amount)}</TableCell>
                  </TableRow>
                ))}
                {!topSuppliers.length && <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">No purchase data</TableCell></TableRow>}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
