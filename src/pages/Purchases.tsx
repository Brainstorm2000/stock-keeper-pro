import { useState } from 'react';
import { usePagination } from '@/hooks/usePagination';
import { TablePagination } from '@/components/ui/table-pagination';
import { format } from 'date-fns';
import { Plus, Trash2, Eye, Package, Filter, DollarSign, CheckCircle2, Clock, AlertCircle, Pencil, RotateCcw } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ModuleAccessGuard, useModuleAccess } from '@/components/access/ModuleAccessGuard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { usePurchases, useDeletePurchase, type Purchase } from '@/hooks/usePurchases';
import { useBranches } from '@/hooks/useBranches';
import { useAuth } from '@/lib/auth';
import { PurchaseDialog } from '@/components/purchases/PurchaseDialog';
import { PurchaseDetailsDialog } from '@/components/purchases/PurchaseDetailsDialog';
import { EditPurchaseDialog } from '@/components/purchases/EditPurchaseDialog';
import { PurchaseReturnDialog } from '@/components/purchases/PurchaseReturnDialog';

export default function Purchases() {
  const { isAdmin } = useAuth();
  const { canCreate, canEdit, canDelete } = useModuleAccess('purchases');
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailsDialogPurchase, setDetailsDialogPurchase] = useState<Purchase | null>(null);
  const [editDialogPurchase, setEditDialogPurchase] = useState<Purchase | null>(null);
  const [returnDialogPurchase, setReturnDialogPurchase] = useState<Purchase | null>(null);

  const { data: branches = [] } = useBranches();
  const { data: purchases = [], isLoading } = usePurchases(selectedBranch || undefined);
  const deletePurchase = useDeletePurchase();

  const filteredPurchases = purchases.filter(p => {
    if (statusFilter !== 'all' && p.payment_status !== statusFilter) return false;
    return true;
  });

  const { paginatedItems: paginatedPurchases, currentPage, totalPages, totalItems, pageSize, goToPage } = usePagination(filteredPurchases);

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const getPaymentStatusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20"><CheckCircle2 className="h-3 w-3 mr-1" />Paid</Badge>;
      case 'partial':
        return <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20"><AlertCircle className="h-3 w-3 mr-1" />Partial</Badge>;
      default:
        return <Badge className="bg-red-500/10 text-red-600 border-red-500/20"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
    }
  };

  // Summary stats
  const totalPurchases = filteredPurchases.reduce((sum, p) => sum + Number(p.total_amount), 0);
  const totalPaid = filteredPurchases.reduce((sum, p) => sum + Number(p.amount_paid), 0);
  const totalPending = totalPurchases - totalPaid;

  return (
    <DashboardLayout>
      <ModuleAccessGuard module="purchases">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Purchases</h1>
            <p className="text-muted-foreground">Manage inventory purchases from suppliers</p>
          </div>
          {canCreate && (
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Purchase
            </Button>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-primary/10">
                  <Package className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Purchases</p>
                  <p className="text-2xl font-bold">{formatCurrency(totalPurchases)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-green-500/10">
                  <CheckCircle2 className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Amount Paid</p>
                  <p className="text-2xl font-bold">{formatCurrency(totalPaid)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-red-500/10">
                  <DollarSign className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pending Payment</p>
                  <p className="text-2xl font-bold">{formatCurrency(totalPending)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4">
          <Select value={selectedBranch || "all"} onValueChange={(v) => setSelectedBranch(v === "all" ? "" : v)}>
            <SelectTrigger className="w-[200px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="All Branches" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Branches</SelectItem>
              {branches.filter(branch => branch.id).map(branch => (
                <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Payment Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="partial">Partial</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Purchases Table */}
        <Card>
          <CardHeader>
            <CardTitle>Purchase Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>PO Number</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Supplier</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Items</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Payment</TableHead>
                        {isAdmin && <TableHead className="w-[100px]">Actions</TableHead>}
                      </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={isAdmin ? 8 : 7} className="text-center py-8 text-muted-foreground">
                        Loading purchases...
                      </TableCell>
                    </TableRow>
                  ) : filteredPurchases.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={isAdmin ? 8 : 7} className="text-center py-8 text-muted-foreground">
                        No purchases found
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedPurchases.map(purchase => (
                      <TableRow key={purchase.id} className="group">
                        <TableCell className="font-medium">
                          {purchase.purchase_number}
                          {purchase.reference_number && (
                            <span className="block text-xs text-muted-foreground">
                              Ref: {purchase.reference_number}
                            </span>
                          )}
                        </TableCell>
                        <TableCell>{format(new Date(purchase.purchase_date), 'MMM d, yyyy')}</TableCell>
                        <TableCell>{purchase.suppliers?.name || '—'}</TableCell>
                        <TableCell>{purchase.branches?.name || '—'}</TableCell>
                        <TableCell>{purchase.purchase_items?.length || 0} items</TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatCurrency(Number(purchase.total_amount))}
                        </TableCell>
                        <TableCell>{getPaymentStatusBadge(purchase.payment_status)}</TableCell>
                        {isAdmin && (
                          <TableCell>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDetailsDialogPurchase(purchase)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              {canEdit && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setEditDialogPurchase(purchase)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              )}
                              {canEdit && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Return Items"
                                  onClick={() => setReturnDialogPurchase(purchase)}
                                >
                                  <RotateCcw className="h-4 w-4" />
                                </Button>
                              )}
                              {canDelete && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="text-destructive">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Delete Purchase?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        This will delete {purchase.purchase_number} and reverse the stock additions. This action cannot be undone.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => deletePurchase.mutate(purchase)}
                                        className="bg-destructive text-destructive-foreground"
                                      >
                                        Delete
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              )}
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
              <TablePagination currentPage={currentPage} totalPages={totalPages} totalItems={totalItems} pageSize={pageSize} onPageChange={goToPage} />
            </div>
          </CardContent>
        </Card>
      </div>

      <PurchaseDialog open={dialogOpen} onOpenChange={setDialogOpen} />
      
      {detailsDialogPurchase && (
        <PurchaseDetailsDialog
          purchase={detailsDialogPurchase}
          open={!!detailsDialogPurchase}
          onOpenChange={(open) => !open && setDetailsDialogPurchase(null)}
        />
      )}

      {editDialogPurchase && (
        <EditPurchaseDialog
          purchase={editDialogPurchase}
          open={!!editDialogPurchase}
          onOpenChange={(open) => !open && setEditDialogPurchase(null)}
        />
      )}

      {returnDialogPurchase && (
        <PurchaseReturnDialog
          purchase={returnDialogPurchase}
          open={!!returnDialogPurchase}
          onOpenChange={(open) => !open && setReturnDialogPurchase(null)}
        />
      )}
      </ModuleAccessGuard>
    </DashboardLayout>
  );
}
