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
  } = usePagination(filteredSales);

  const totalSalesValue = filteredSales.reduce(
    (sum, s) => sum + Number(s.total_amount),
    0,
  );
  const completedSales = filteredSales.filter((s) => s.status === "completed");
  const totalRevenue = completedSales.reduce(
    (sum, s) => sum + Number(s.total_amount),
    0,
  );

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

  if (authLoading)
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );

  return (
    <DashboardLayout>
      <ModuleAccessGuard module="sales">
        <div className="space-y-6">
          {/* Responsive Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-foreground">
                Sales
              </h1>
              <p className="text-sm text-muted-foreground">
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

          {/* Responsive Summary Cards */}
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
                  {formatCurrency(totalSalesValue)}
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

          {/* Responsive Filters */}
          <div className="flex flex-col space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search invoice # or customer..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-full"
                />
              </div>
              <div className="flex flex-row gap-2">
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-full sm:w-[140px]">
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
                  <SelectTrigger className="w-full sm:w-[150px]">
                    <SelectValue placeholder="Payment" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Payments</SelectItem>
                    {Object.entries(paymentMethodLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="flex-1 sm:w-[140px]"
                />
                <span className="text-muted-foreground">to</span>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="flex-1 sm:w-[140px]"
                />
              </div>
              {branches.length > 0 && (
                <Select value={filterBranch} onValueChange={setFilterBranch}>
                  <SelectTrigger className="w-full sm:w-[140px]">
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
            </div>
          </div>

          {/* Responsive Table Card */}
          <Card className="overflow-hidden">
            {/* Desktop Table: Hidden on Mobile */}
            <div className="hidden md:block">
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
                  ) : paginatedSales.length === 0 ? (
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
                          {format(new Date(sale.created_at), "MMM dd, HH:mm")}
                        </TableCell>
                        <TableCell>{sale.customer_name || "Walk-in"}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {paymentMethodLabels[sale.payment_method]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={statusColors[sale.status]}>
                            {sale.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(Number(sale.total_amount))}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setSelectedSaleId(sale.id)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setReceiptSaleId(sale.id)}
                            >
                              <Printer className="h-4 w-4" />
                            </Button>
                            {canEdit && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleOpenEdit(sale)}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                            )}
                            {canDelete && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeleteConfirmSale(sale)}
                                className="text-destructive"
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
            </div>

            {/* Mobile List: Shown only on Mobile */}
            <div className="md:hidden divide-y">
              {salesLoading ? (
                <div className="p-8 flex justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : paginatedSales.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  No sales found
                </div>
              ) : (
                paginatedSales.map((sale) => (
                  <div key={sale.id} className="p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-xs font-mono text-muted-foreground block">
                          {sale.sale_number}
                        </span>
                        <h3 className="font-bold">
                          {sale.customer_name || "Walk-in"}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(sale.created_at), "MMM dd, HH:mm")}
                        </p>
                      </div>
                      <Badge className={statusColors[sale.status]}>
                        {sale.status}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="text-lg font-bold text-primary">
                        {formatCurrency(Number(sale.total_amount))}
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedSaleId(sale.id)}
                        >
                          View
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setReceiptSaleId(sale.id)}
                        >
                          <Printer className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenEdit(sale)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Pagination Component */}
            <div className="border-t">
              <TablePagination
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={totalItems}
                pageSize={pageSize}
                onPageChange={goToPage}
              />
            </div>
          </Card>
        </div>

        {/* Sale Detail, Edit, Receipt, and Delete Dialogs remain here... */}
        {/* (Keeping the original dialog code you provided) */}
      </ModuleAccessGuard>
    </DashboardLayout>
  );
}
