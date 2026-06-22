import { useState, useEffect, useMemo } from "react";
import { usePagination } from "@/hooks/usePagination";
import { TablePagination } from "@/components/ui/table-pagination";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Loader2,
  Eye,
  Calendar,
  Printer,
  Edit2,
  Trash2,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import {
  ModuleAccessGuard,
  useModuleAccess,
} from "@/components/access/ModuleAccessGuard";
import { useBranches } from "@/hooks/useBranches";
import { useOrganization } from "@/hooks/useOrganization";
import { useAuth } from "@/lib/auth";
import {
  useSales,
  useSaleWithItems,
  useUpdateSale,
  useDeleteSale,
  type Sale,
  type PaymentMethod,
  type SaleStatus,
} from "@/hooks/useSales";
import { useSaleReturns } from '@/hooks/useSaleReturns';
import { ReceiptDialog } from "@/components/pos/ReceiptDialog";
import { SaleReturnDialog } from "@/components/sales/SaleReturnDialog";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/currency";

const statusColors: Record<SaleStatus, string> = {
  completed:
    "bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/20",
  pending:
    "bg-yellow-500/10 text-yellow-700 dark:text-yellow-300 border-yellow-500/20",
  cancelled: "bg-destructive/10 text-destructive border-destructive/20",
  on_hold: "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20",
};

const paymentStatusColors: Record<string, string> = {
  paid: "bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/20",
  partial: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
  outstanding: "bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20",
};

const paymentMethodLabels: Record<PaymentMethod, string> = {
  cash: "Cash",
  card: "Card",
  mobile_money: "Mobile Money",
  bank_transfer: "Bank Transfer",
  credit: "Credit",
};

export default function Sales() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPayment, setFilterPayment] = useState<string>("all");
  const [filterBranch, setFilterBranch] = useState<string>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [receiptSaleId, setReceiptSaleId] = useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editData, setEditData] = useState<{
    customer_name: string;
    customer_phone: string;
    payment_method: PaymentMethod;
    status: SaleStatus;
    notes: string;
  }>({
    customer_name: "",
    customer_phone: "",
    payment_method: "cash",
    status: "completed",
    notes: "",
  });
  const [deleteConfirmSale, setDeleteConfirmSale] = useState<Sale | null>(null);
  const [returnSale, setReturnSale] = useState<Sale | null>(null);

  const { user, loading: authLoading, hasCompletedOnboarding } = useAuth();
  const { canEdit, canDelete } = useModuleAccess("sales");
  const { canEdit: canReturnEdit } = useModuleAccess("returns");
  const { data: sales = [], isLoading: salesLoading } = useSales();
  const { data: branches = [] } = useBranches();
  const { data: saleReturns = [] } = useSaleReturns();
  const { data: organization } = useOrganization();
  const { data: selectedSale } = useSaleWithItems(selectedSaleId);
  const { data: receiptSale } = useSaleWithItems(receiptSaleId);
  const updateSale = useUpdateSale();
  const deleteSale = useDeleteSale();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    } else if (!authLoading && user && hasCompletedOnboarding === false) {
      navigate("/onboarding");
    }
  }, [user, authLoading, hasCompletedOnboarding, navigate]);

  // Filter sales
  const filteredSales = useMemo(() => {
    return sales.filter((sale) => {
      const matchesSearch =
        sale.sale_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (sale.customer_name &&
          sale.customer_name.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesStatus =
        filterStatus === "all" || sale.status === filterStatus;
      const matchesPayment =
        filterPayment === "all" || sale.payment_method === filterPayment;
      const matchesBranch =
        filterBranch === "all" || sale.branch_id === filterBranch;

      const saleDate = new Date(sale.created_at);
      const matchesStartDate = !startDate || saleDate >= new Date(startDate);
      const matchesEndDate =
        !endDate || saleDate <= new Date(endDate + "T23:59:59");

      return (
        matchesSearch &&
        matchesStatus &&
        matchesPayment &&
        matchesBranch &&
        matchesStartDate &&
        matchesEndDate
      );
    });
  }, [
    sales,
    searchQuery,
    filterStatus,
    filterPayment,
    filterBranch,
    startDate,
    endDate,
  ]);

  const {
    paginatedItems: paginatedSales,
    currentPage,
    totalPages,
    totalItems,
    pageSize,
    goToPage,
    setPageSize,
  } = usePagination(filteredSales);

  // Calculate totals
  const totalSales = filteredSales.reduce(
    (sum, s) => sum + Number(s.total_amount),
    0,
  );
  // Map of return totals by sale id for quick lookup
  const returnsBySaleId: Record<string, number> = (saleReturns || []).reduce(
    (acc, r) => {
      acc[r.sale_id] = (acc[r.sale_id] || 0) + Number(r.total_amount || 0);
      return acc;
    },
    {} as Record<string, number>,
  );

  // Adjust total sales value by subtracting returns for each sale
  const adjustedTotalSales = filteredSales.reduce((sum, s) => {
    const returns = Number(returnsBySaleId[s.id] || 0);
    const adjusted = Math.max(0, Number(s.total_amount || 0) - returns);
    return sum + adjusted;
  }, 0);
  // Revenue: sum of collected amounts (total_amount minus outstanding balance)
  // Exclude cancelled sales. Then subtract any returned amounts associated
  // with the filtered sales so returns reduce revenue.
  const collectedRevenue = filteredSales.reduce((sum, s) => {
    if (s.status === "cancelled") return sum;
    const total = Number(s.total_amount || 0);
    const outstanding = Number((s as any).balance_due || 0);
    return sum + Math.max(0, total - outstanding);
  }, 0);

  const totalReturnsForFilteredSales = (saleReturns || []).reduce((sum, r) => {
    // Only count returns that belong to sales in the current filtered set
    const belongs = filteredSales.some((s) => s.id === r.sale_id);
    return sum + (belongs ? Number(r.total_amount || 0) : 0);
  }, 0);

  const totalRevenue = Math.max(0, collectedRevenue - totalReturnsForFilteredSales);

  const handleOpenEdit = (sale: Sale) => {
    setEditData({
      customer_name: sale.customer_name || "",
      customer_phone: sale.customer_phone || "",
      payment_method: sale.payment_method,
      status: sale.status,
      notes: sale.notes || "",
    });
    setSelectedSaleId(sale.id);
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedSaleId) return;

    await updateSale.mutateAsync({
      saleId: selectedSaleId,
      updates: {
        customer_name: editData.customer_name || null,
        customer_phone: editData.customer_phone || null,
        payment_method: editData.payment_method,
        status: editData.status,
        notes: editData.notes || null,
      },
    });

    setEditDialogOpen(false);
    setSelectedSaleId(null);
  };

  const handleDeleteSale = async () => {
    if (!deleteConfirmSale) return;
    await deleteSale.mutateAsync(deleteConfirmSale.id);
    setDeleteConfirmSale(null);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <DashboardLayout>
      <ModuleAccessGuard module="sales">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Sales</h1>
              <p className="text-muted-foreground">
                View and manage your sales history
              </p>
            </div>

            <Button
              onClick={() => navigate("/pos")}
              className="w-full sm:w-auto bg-[#FF9E3D] hover:bg-[#e88d30] text-[#000B26] font-bold shadow-md shadow-amber-500/10 transition-all active:scale-[0.98]"
            >
              Go to POS
            </Button>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Sales
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{filteredSales.length}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Value
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(adjustedTotalSales)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Revenue (Completed)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-[#FF9E3D]">
                  {formatCurrency(totalRevenue)}
                </div>
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
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name}
                    </SelectItem>
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
                  <TableHead className="w-[120px]">Actions</TableHead>
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
                    <TableCell
                      colSpan={7}
                      className="text-center py-8 text-muted-foreground"
                    >
                      No sales found
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedSales.map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell className="font-mono font-medium">
                        {sale.sale_number}
                      </TableCell>
                      <TableCell>
                        {format(
                          new Date(sale.created_at),
                          "MMM dd, yyyy HH:mm",
                        )}
                      </TableCell>
                      <TableCell>{sale.customer_name || "Walk-in"}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {paymentMethodLabels[sale.payment_method]}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {sale.status === "completed" && sale.payment_status && sale.payment_status !== "paid" ? (
                          <Badge className={paymentStatusColors[sale.payment_status]}>
                            {sale.payment_status === "partial" ? "Partial" : "Credit"}
                          </Badge>
                        ) : (
                          <Badge className={statusColors[sale.status]}>
                            {sale.status}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(Number(sale.total_amount))}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            title="View Details"
                            onClick={() => setSelectedSaleId(sale.id)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Print Receipt"
                            onClick={() => setReceiptSaleId(sale.id)}
                          >
                            <Printer className="h-4 w-4" />
                          </Button>
                          {canEdit && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Edit in POS"
                              onClick={() => navigate(`/pos?editSaleId=${sale.id}`)}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                          )}
                          {canEdit && canReturnEdit && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Return Items"
                              onClick={() => setReturnSale(sale)}
                            >
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                          )}
                          {canDelete && (
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Delete Sale"
                              onClick={() => setDeleteConfirmSale(sale)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
            <TablePagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalItems}
              pageSize={pageSize}
              onPageChange={goToPage}
              onPageSizeChange={setPageSize}
            />
          </Card>
        </div>

        {/* Sale Detail Dialog */}
        <Dialog
          open={!!selectedSaleId && !editDialogOpen}
          onOpenChange={() => setSelectedSaleId(null)}
        >
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>
                Sale Details - {selectedSale?.sale_number}
              </DialogTitle>
            </DialogHeader>

            {selectedSale && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Date</p>
                    <p className="font-medium">
                      {format(new Date(selectedSale.created_at), "PPpp")}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Customer</p>
                    <p className="font-medium">
                      {selectedSale.customer_name || "Walk-in"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Payment</p>
                    <p className="font-medium">
                      {paymentMethodLabels[selectedSale.payment_method]}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Status</p>
                    {selectedSale.status === "completed" && selectedSale.payment_status && selectedSale.payment_status !== "paid" ? (
                      <Badge className={paymentStatusColors[selectedSale.payment_status]}>
                        {selectedSale.payment_status === "partial" ? "Partial" : "Credit"}
                      </Badge>
                    ) : (
                      <Badge className={statusColors[selectedSale.status]}>
                        {selectedSale.status}
                      </Badge>
                    )}
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
                          <TableCell className="text-center">
                            {item.quantity}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(Number(item.unit_price))}
                          </TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(Number(item.total_price))}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="space-y-2 text-sm border-t pt-4">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span>{formatCurrency(Number(selectedSale.subtotal))}</span>
                  </div>
                  {Number(selectedSale.discount_amount) > 0 && (
                    <div className="flex justify-between text-destructive">
                      <span>Discount</span>
                      <span>
                        -{formatCurrency(Number(selectedSale.discount_amount))}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-bold pt-2 border-t">
                    <span>Total</span>
                    <span>
                      {formatCurrency(Number(selectedSale.total_amount))}
                    </span>
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

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  if (selectedSaleId) setReceiptSaleId(selectedSaleId);
                  setSelectedSaleId(null);
                }}
              >
                <Printer className="h-4 w-4 mr-2" />
                Print Receipt
              </Button>
              <Button variant="outline" onClick={() => setSelectedSaleId(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Sale Dialog */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Sale</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Customer Name</Label>
                  <Input
                    value={editData.customer_name}
                    onChange={(e) =>
                      setEditData((prev) => ({
                        ...prev,
                        customer_name: e.target.value,
                      }))
                    }
                    placeholder="Optional"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Phone</Label>
                  <Input
                    value={editData.customer_phone}
                    onChange={(e) =>
                      setEditData((prev) => ({
                        ...prev,
                        customer_phone: e.target.value,
                      }))
                    }
                    placeholder="Optional"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Payment Method</Label>
                <Select
                  value={editData.payment_method}
                  onValueChange={(val: PaymentMethod) =>
                    setEditData((prev) => ({ ...prev, payment_method: val }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="card">Card</SelectItem>
                    <SelectItem value="mobile_money">Mobile Money</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="credit">Credit</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={editData.status}
                  onValueChange={(val: SaleStatus) =>
                    setEditData((prev) => ({ ...prev, status: val }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="completed">Completed</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                    <SelectItem value="on_hold">On Hold</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea
                  value={editData.notes}
                  onChange={(e) =>
                    setEditData((prev) => ({ ...prev, notes: e.target.value }))
                  }
                  placeholder="Optional notes..."
                  rows={2}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setEditDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="secondary"
                className="mr-auto"
                onClick={() => {
                  if (selectedSaleId) {
                    navigate(`/pos?editSaleId=${selectedSaleId}`);
                  }
                }}
                disabled={!selectedSaleId}
              >
                Edit in POS
              </Button>
              <Button onClick={handleSaveEdit} disabled={updateSale.isPending}>
                {updateSale.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Receipt Dialog */}
        <ReceiptDialog
          open={!!receiptSaleId}
          onOpenChange={(open) => !open && setReceiptSaleId(null)}
          sale={receiptSale || null}
          organizationName={organization?.name}
          organizationAddress={organization?.address || undefined}
          organizationEmail={organization?.email || undefined}
        />

        {/* Delete Confirmation Dialog */}
        <AlertDialog
          open={!!deleteConfirmSale}
          onOpenChange={(open) => !open && setDeleteConfirmSale(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Sale</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete sale{" "}
                <span className="font-mono font-semibold">
                  {deleteConfirmSale?.sale_number}
                </span>
                ? This will restore the stock for all items in this sale. This
                action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDeleteSale}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={deleteSale.isPending}
              >
                {deleteSale.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Delete Sale"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {returnSale && (
          <SaleReturnDialog
            sale={returnSale}
            open={!!returnSale}
            onOpenChange={(open) => {
              if (!open) setReturnSale(null);
            }}
          />
        )}
      </ModuleAccessGuard>
    </DashboardLayout>
  );
}
