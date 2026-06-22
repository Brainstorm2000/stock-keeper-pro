import { useState, useMemo } from 'react';
import { usePagination } from '@/hooks/usePagination';
import { TablePagination } from '@/components/ui/table-pagination';
import { Search, Loader2, DollarSign, Download, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ModuleAccessGuard } from '@/components/access/ModuleAccessGuard';
import { useOutstandingSales, useRecordDebtPayment, useDebtPayments } from '@/hooks/useDebts';
import { useSales } from '@/hooks/useSales';
import { format } from 'date-fns';
import { formatCurrency } from '@/lib/currency';

const statusColors: Record<string, string> = {
  paid: 'bg-green-500/10 text-green-700 dark:text-green-300',
  partial: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-300',
  outstanding: 'bg-red-500/10 text-red-700 dark:text-red-300',
};

export default function Debts() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [paymentDialog, setPaymentDialog] = useState<{ saleId: string; balance: number; customerName: string } | null>(null);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [historyDialog, setHistoryDialog] = useState<string | null>(null);

  const { data: allSales = [], isLoading } = useSales();
  const recordPayment = useRecordDebtPayment();
  const { data: debtPayments = [] } = useDebtPayments(historyDialog);

  // Show all sales that have debt info (outstanding or partial), plus paid ones for historical view
  const debtSales = useMemo(() => {
    return allSales.filter((s: any) => {
      const ps = s.payment_status || 'paid';
      const matchSearch = !search ||
        s.sale_number?.toLowerCase().includes(search.toLowerCase()) ||
        s.customer_name?.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'all' || ps === statusFilter;
      const saleDate = new Date(s.created_at);
      const matchStart = !startDate || saleDate >= new Date(startDate);
      const matchEnd = !endDate || saleDate <= new Date(endDate + 'T23:59:59');
      // Only show sales with outstanding/partial status, or all if filter is 'all'
      const hasDebt = ps === 'outstanding' || ps === 'partial';
      return matchSearch && matchStatus && matchStart && matchEnd && (statusFilter !== 'all' || hasDebt);
    });
  }, [allSales, search, statusFilter, startDate, endDate]);

  const customerDebtSummary = useMemo(() => {
    const totals = debtSales.reduce((acc: Record<string, number>, sale: any) => {
      const customer = sale.customer_name || 'Walk-in';
      acc[customer] = (acc[customer] || 0) + Number(sale.balance_due || 0);
      return acc;
    }, {});

    return Object.entries(totals)
      .map(([customer, amount]) => ({ customer, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [debtSales]);

  const { paginatedItems: paginatedDebts, currentPage, totalPages, totalItems, pageSize, goToPage, setPageSize } = usePagination(debtSales);

  const totalOutstanding = debtSales.reduce((sum: number, s: any) => sum + Number(s.balance_due || 0), 0);
  const totalDebtors = new Set(debtSales.map((s: any) => s.customer_name || 'Walk-in')).size;

  const handleRecordPayment = async () => {
    if (!paymentDialog || !paymentAmount) return;
    await recordPayment.mutateAsync({
      saleId: paymentDialog.saleId,
      amount: Number(paymentAmount),
      paymentMethod,
      notes: paymentNotes || undefined,
    });
    setPaymentDialog(null);
    setPaymentAmount('');
    setPaymentNotes('');
  };

  const exportToCSV = () => {
    const headers = ['Invoice #', 'Date', 'Customer', 'Total Amount', 'Amount Paid', 'Balance Due', 'Payment Status', 'Due Date'];
    const rows = debtSales.map((s: any) => [
      s.sale_number,
      format(new Date(s.created_at), 'yyyy-MM-dd'),
      s.customer_name || 'Walk-in',
      Number(s.total_amount).toFixed(2),
      Number(s.amount_paid || 0).toFixed(2),
      Number(s.balance_due || 0).toFixed(2),
      s.payment_status || 'paid',
      s.due_date || '',
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `debts-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout>
      <ModuleAccessGuard module="debts">
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Debts & Outstanding Payments</h1>
              <p className="text-muted-foreground">Track and manage unpaid and partially paid sales</p>
            </div>
            <Button variant="outline" onClick={exportToCSV} disabled={debtSales.length === 0}>
              <Download className="h-4 w-4 mr-2" />Export CSV
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Outstanding Sales</CardTitle></CardHeader>
                <CardContent><div className="text-2xl font-bold">{debtSales.length}</div></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Outstanding</CardTitle></CardHeader>
                <CardContent><div className="text-2xl font-bold text-destructive">{formatCurrency(totalOutstanding)}</div></CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Debtors</CardTitle></CardHeader>
                <CardContent><div className="text-2xl font-bold">{totalDebtors}</div></CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Top Debtors</CardTitle></CardHeader>
              <CardContent>
                {customerDebtSummary.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No debtors to show.</p>
                ) : (
                  <div className="space-y-3">
                    {customerDebtSummary.slice(0, 5).map((item, index) => (
                      <div key={item.customer} className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium">{item.customer}</p>
                          <p className="text-xs text-muted-foreground">#{index + 1}</p>
                        </div>
                        <div className="text-right font-semibold">{formatCurrency(item.amount)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search by invoice or customer..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Outstanding</SelectItem>
                <SelectItem value="outstanding">Outstanding</SelectItem>
                <SelectItem value="partial">Partial</SelectItem>
              </SelectContent>
            </Select>
            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-[140px]" />
            <span className="self-center text-muted-foreground">to</span>
            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-[140px]" />
          </div>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></TableCell></TableRow>
                ) : debtSales.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">No outstanding debts</TableCell></TableRow>
                ) : (
                  paginatedDebts.map((sale: any) => (
                    <TableRow key={sale.id}>
                      <TableCell className="font-mono">{sale.sale_number}</TableCell>
                      <TableCell>{format(new Date(sale.created_at), 'MMM dd, yyyy')}</TableCell>
                      <TableCell>{sale.customer_name || 'Walk-in'}</TableCell>
                      <TableCell className="text-right">{formatCurrency(Number(sale.total_amount))}</TableCell>
                      <TableCell className="text-right">{formatCurrency(Number(sale.amount_paid || 0))}</TableCell>
                      <TableCell className="text-right font-medium text-destructive">{formatCurrency(Number(sale.balance_due || 0))}</TableCell>
                      <TableCell>
                        <Badge className={statusColors[sale.payment_status || 'paid']}>{sale.payment_status || 'paid'}</Badge>
                      </TableCell>
                      <TableCell>{sale.due_date ? format(new Date(sale.due_date), 'MMM dd, yyyy') : '-'}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {Number(sale.balance_due || 0) > 0 && (
                            <Button variant="outline" size="sm" onClick={() => setPaymentDialog({
                              saleId: sale.id,
                              balance: Number(sale.balance_due),
                              customerName: sale.customer_name || 'Walk-in',
                            })}>
                              <DollarSign className="h-3 w-3 mr-1" />Pay
                            </Button>
                          )}
                          <Button variant="ghost" size="sm" onClick={() => setHistoryDialog(sale.id)}>
                            <CreditCard className="h-3 w-3 mr-1" />History
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <TablePagination currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} pageSize={pageSize} onPageChange={goToPage} onPageSizeChange={setPageSize} />
          </Card>
        </div>

        {/* Record Payment Dialog */}
        <Dialog open={!!paymentDialog} onOpenChange={() => setPaymentDialog(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Record Payment - {paymentDialog?.customerName}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="bg-muted p-3 rounded-lg text-sm">
                <span className="text-muted-foreground">Balance Due: </span>
                <span className="font-bold text-destructive">{formatCurrency(paymentDialog?.balance || 0)}</span>
              </div>
              <div className="space-y-2">
                <Label>Payment Amount *</Label>
                <Input
                  type="number"
                  min="0.01"
                  max={paymentDialog?.balance}
                  step="0.01"
                  value={paymentAmount}
                  onChange={e => setPaymentAmount(e.target.value)}
                  placeholder="Enter amount"
                />
              </div>
              <div className="space-y-2">
                <Label>Payment Method</Label>
                <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="mobile_money">Mobile Money</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea value={paymentNotes} onChange={e => setPaymentNotes(e.target.value)} placeholder="Optional notes..." rows={2} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setPaymentDialog(null)}>Cancel</Button>
              <Button onClick={handleRecordPayment} disabled={!paymentAmount || Number(paymentAmount) <= 0 || recordPayment.isPending}>
                {recordPayment.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Record Payment
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Payment History Dialog */}
        <Dialog open={!!historyDialog} onOpenChange={() => setHistoryDialog(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>Payment History</DialogTitle></DialogHeader>
            {debtPayments.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">No payments recorded yet</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Method</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Notes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {debtPayments.map(p => (
                    <TableRow key={p.id}>
                      <TableCell>{format(new Date(p.created_at), 'MMM dd, yyyy')}</TableCell>
                      <TableCell className="capitalize">{p.payment_method.replace('_', ' ')}</TableCell>
                      <TableCell className="text-right font-medium">{formatCurrency(Number(p.amount))}</TableCell>
                      <TableCell className="max-w-[120px] truncate">{p.notes || '-'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </DialogContent>
        </Dialog>
      </ModuleAccessGuard>
    </DashboardLayout>
  );
}
