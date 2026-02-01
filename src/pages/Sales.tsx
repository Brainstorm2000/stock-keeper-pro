import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Loader2, Eye, Calendar, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useBranches } from '@/hooks/useBranches';
import { useAuth } from '@/lib/auth';
import { useSales, useSaleWithItems, type Sale, type PaymentMethod, type SaleStatus } from '@/hooks/useSales';
import { format } from 'date-fns';

const statusColors: Record<SaleStatus, string> = {
  completed: 'bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/20',
  pending: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-300 border-yellow-500/20',
  cancelled: 'bg-destructive/10 text-destructive border-destructive/20',
  on_hold: 'bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20',
};

const paymentMethodLabels: Record<PaymentMethod, string> = {
  cash: 'Cash',
  card: 'Card',
  mobile_money: 'Mobile Money',
  bank_transfer: 'Bank Transfer',
  credit: 'Credit',
};

export default function Sales() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterPayment, setFilterPayment] = useState<string>('all');
  const [filterBranch, setFilterBranch] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);

  const { user, loading: authLoading, hasCompletedOnboarding } = useAuth();
  const { data: sales = [], isLoading: salesLoading } = useSales();
  const { data: branches = [] } = useBranches();
  const { data: selectedSale } = useSaleWithItems(selectedSaleId);
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    } else if (!authLoading && user && hasCompletedOnboarding === false) {
      navigate('/onboarding');
    }
  }, [user, authLoading, hasCompletedOnboarding, navigate]);

  // Filter sales
  const filteredSales = useMemo(() => {
    return sales.filter(sale => {
      const matchesSearch = 
        sale.sale_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (sale.customer_name && sale.customer_name.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesStatus = filterStatus === 'all' || sale.status === filterStatus;
      const matchesPayment = filterPayment === 'all' || sale.payment_method === filterPayment;
      const matchesBranch = filterBranch === 'all' || sale.branch_id === filterBranch;
      
      const saleDate = new Date(sale.created_at);
      const matchesStartDate = !startDate || saleDate >= new Date(startDate);
      const matchesEndDate = !endDate || saleDate <= new Date(endDate + 'T23:59:59');
      
      return matchesSearch && matchesStatus && matchesPayment && matchesBranch && matchesStartDate && matchesEndDate;
    });
  }, [sales, searchQuery, filterStatus, filterPayment, filterBranch, startDate, endDate]);

  // Calculate totals
  const totalSales = filteredSales.reduce((sum, s) => sum + Number(s.total_amount), 0);
  const completedSales = filteredSales.filter(s => s.status === 'completed');
  const totalRevenue = completedSales.reduce((sum, s) => sum + Number(s.total_amount), 0);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Sales</h1>
            <p className="text-muted-foreground">View and manage your sales history</p>
          </div>
          
          <Button onClick={() => navigate('/pos')}>
            Go to POS
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Sales</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{filteredSales.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Value</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalSales.toLocaleString()}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Revenue (Completed)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{totalRevenue.toLocaleString()}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by invoice # or customer..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="on_hold">On Hold</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterPayment} onValueChange={setFilterPayment}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Payment" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Payments</SelectItem>
              <SelectItem value="cash">Cash</SelectItem>
              <SelectItem value="card">Card</SelectItem>
              <SelectItem value="mobile_money">Mobile Money</SelectItem>
              <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
              <SelectItem value="credit">Credit</SelectItem>
            </SelectContent>
          </Select>
          {branches.length > 0 && (
            <Select value={filterBranch} onValueChange={setFilterBranch}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Branch" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Branches</SelectItem>
                {branches.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-[140px]"
            />
            <span className="text-muted-foreground">to</span>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-[140px]"
            />
          </div>
        </div>

        {/* Sales Table */}
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {salesLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ) : filteredSales.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No sales found
                  </TableCell>
                </TableRow>
              ) : (
                filteredSales.map((sale) => (
                  <TableRow key={sale.id}>
                    <TableCell className="font-mono font-medium">{sale.sale_number}</TableCell>
                    <TableCell>{format(new Date(sale.created_at), 'MMM dd, yyyy HH:mm')}</TableCell>
                    <TableCell>{sale.customer_name || 'Walk-in'}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{paymentMethodLabels[sale.payment_method]}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[sale.status]}>{sale.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {Number(sale.total_amount).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => setSelectedSaleId(sale.id)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* Sale Detail Dialog */}
      <Dialog open={!!selectedSaleId} onOpenChange={() => setSelectedSaleId(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Sale Details - {selectedSale?.sale_number}</DialogTitle>
          </DialogHeader>
          
          {selectedSale && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Date</p>
                  <p className="font-medium">{format(new Date(selectedSale.created_at), 'PPpp')}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Customer</p>
                  <p className="font-medium">{selectedSale.customer_name || 'Walk-in'}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Payment</p>
                  <p className="font-medium">{paymentMethodLabels[selectedSale.payment_method]}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Status</p>
                  <Badge className={statusColors[selectedSale.status]}>{selectedSale.status}</Badge>
                </div>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Item</TableHead>
                      <TableHead className="text-center">Qty</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedSale.sale_items?.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.product_name}</TableCell>
                        <TableCell className="text-center">{item.quantity}</TableCell>
                        <TableCell className="text-right">{Number(item.unit_price).toLocaleString()}</TableCell>
                        <TableCell className="text-right">{Number(item.total_price).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="space-y-2 text-sm border-t pt-4">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{Number(selectedSale.subtotal).toLocaleString()}</span>
                </div>
                {Number(selectedSale.discount_amount) > 0 && (
                  <div className="flex justify-between text-destructive">
                    <span>Discount</span>
                    <span>-{Number(selectedSale.discount_amount).toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-lg font-bold pt-2 border-t">
                  <span>Total</span>
                  <span>{Number(selectedSale.total_amount).toLocaleString()}</span>
                </div>
              </div>

              {selectedSale.notes && (
                <div className="text-sm">
                  <p className="text-muted-foreground">Notes</p>
                  <p>{selectedSale.notes}</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedSaleId(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
