import { useMemo } from 'react';
import { format, isSameDay, eachDayOfInterval } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Download, FileText, Wallet, TrendingDown, BarChart3, Tags } from 'lucide-react';
import { BarChart, Bar, PieChart, Pie, Cell, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { formatCurrency } from '@/lib/currency';
import { exportToCSV, exportToPDF } from '@/lib/export-utils';
import { DateRange } from '@/components/reports/DateRangeFilter';
import { useOrganization } from '@/hooks/useOrganization';

interface ExpenseReportTabProps {
  expenses: any[];
  categories: any[];
  dateRange: DateRange;
  branches: any[];
  selectedBranch: string;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))', 'hsl(var(--destructive))'];

export function ExpenseReportTab({ expenses, categories, dateRange, branches, selectedBranch }: ExpenseReportTabProps) {
  const { data: org } = useOrganization();
  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => {
      const d = new Date(e.expense_date);
      const inRange = d >= dateRange.from && d <= dateRange.to;
      const inBranch = selectedBranch === 'all' || e.branch_id === selectedBranch;
      return inRange && inBranch;
    });
  }, [expenses, dateRange, selectedBranch]);

  const totalExpenses = filteredExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);
  const avgExpense = filteredExpenses.length ? totalExpenses / filteredExpenses.length : 0;
  const maxExpense = filteredExpenses.reduce((max, e) => Math.max(max, Number(e.amount || 0)), 0);

  // Expenses over time
  const expensesByDay = useMemo(() => {
    const days = eachDayOfInterval({ start: dateRange.from, end: dateRange.to });
    return days.map(day => {
      const dayExpenses = filteredExpenses.filter(e => isSameDay(new Date(e.expense_date), day));
      return {
        date: format(day, 'MMM dd'),
        amount: dayExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0),
      };
    });
  }, [filteredExpenses, dateRange]);

  // By category
  const categoryBreakdown = useMemo(() => {
    const map: Record<string, { name: string; amount: number; count: number }> = {};
    filteredExpenses.forEach(e => {
      const cat = categories.find(c => c.id === e.category_id);
      const name = cat?.name || 'Uncategorized';
      if (!map[name]) map[name] = { name, amount: 0, count: 0 };
      map[name].amount += Number(e.amount || 0);
      map[name].count += 1;
    });
    return Object.values(map).sort((a, b) => b.amount - a.amount);
  }, [filteredExpenses, categories]);

  // By branch
  const branchBreakdown = useMemo(() => {
    const map: Record<string, { name: string; amount: number }> = {};
    filteredExpenses.forEach(e => {
      const branch = branches.find(b => b.id === e.branch_id);
      const name = branch?.name || 'No Branch';
      if (!map[name]) map[name] = { name, amount: 0 };
      map[name].amount += Number(e.amount || 0);
    });
    return Object.values(map).sort((a, b) => b.amount - a.amount);
  }, [filteredExpenses, branches]);

  const handleExportCSV = () => {
    exportToCSV(filteredExpenses.map(e => ({
      Date: e.expense_date,
      Description: e.description,
      Category: categories.find(c => c.id === e.category_id)?.name || '-',
      Amount: e.amount,
      Branch: branches.find(b => b.id === e.branch_id)?.name || '-',
      Notes: e.notes || '',
    })), 'expense_report');
  };

  const handleExportPDF = () => {
    exportToPDF('Expense Report', ['Date', 'Description', 'Category', 'Amount'],
      filteredExpenses.map(e => [e.expense_date, e.description, categories.find(c => c.id === e.category_id)?.name || '-', formatCurrency(e.amount)]),
      { 'Total Expenses': formatCurrency(totalExpenses), 'Entries': String(filteredExpenses.length), 'Average': formatCurrency(avgExpense) }
    );
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><Wallet className="h-3.5 w-3.5" /> Total Expenses</div>
          <p className="text-xl font-bold">{formatCurrency(totalExpenses)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><BarChart3 className="h-3.5 w-3.5" /> Entries</div>
          <p className="text-xl font-bold">{filteredExpenses.length}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <div className="text-muted-foreground text-xs mb-1">Average</div>
          <p className="text-xl font-bold">{formatCurrency(avgExpense)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><TrendingDown className="h-3.5 w-3.5" /> Largest</div>
          <p className="text-xl font-bold">{formatCurrency(maxExpense)}</p>
        </CardContent></Card>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={handleExportCSV}><Download className="h-4 w-4 mr-1" /> CSV</Button>
        <Button variant="outline" size="sm" onClick={handleExportPDF}><FileText className="h-4 w-4 mr-1" /> PDF</Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Expense Trend</CardTitle></CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={expensesByDay}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
              <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
              <Line type="monotone" dataKey="amount" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-sm">By Category</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={categoryBreakdown} dataKey="amount" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {categoryBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">By Branch</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={branchBreakdown} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={100} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Bar dataKey="amount" fill="hsl(var(--chart-4))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Category Details */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Category Breakdown</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Entries</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">% of Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {categoryBreakdown.map(c => (
                <TableRow key={c.name}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-right">{c.count}</TableCell>
                  <TableCell className="text-right">{formatCurrency(c.amount)}</TableCell>
                  <TableCell className="text-right">{totalExpenses ? ((c.amount / totalExpenses) * 100).toFixed(1) : 0}%</TableCell>
                </TableRow>
              ))}
              {!categoryBreakdown.length && <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">No expense data</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
