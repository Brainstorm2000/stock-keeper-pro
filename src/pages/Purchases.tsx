import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";

import {
  Plus,
  Trash2,
  Eye,
  Package,
  Filter,
  DollarSign,
  CheckCircle2,
  Clock,
  AlertCircle,
  Pencil,
  RotateCcw,
  Loader2,
  FileSpreadsheet,
} from "lucide-react";

import { DashboardLayout } from "@/components/layout/DashboardLayout";

import {
  ModuleAccessGuard,
  useModuleAccess,
} from "@/components/access/ModuleAccessGuard";

import { usePagination } from "@/hooks/usePagination";

import { TablePagination } from "@/components/ui/table-pagination";

import { Button } from "@/components/ui/button";

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import {
  usePurchases,
  useDeletePurchase,
  type Purchase,
} from "@/hooks/usePurchases";

import { useBranches } from "@/hooks/useBranches";

import { useAuth } from "@/lib/auth";

import { PurchaseDialog } from "@/components/purchases/PurchaseDialog";

import { PurchaseDetailsDialog } from "@/components/purchases/PurchaseDetailsDialog";

import { EditPurchaseDialog } from "@/components/purchases/EditPurchaseDialog";

import { PurchaseReturnDialog } from "@/components/purchases/PurchaseReturnDialog";
import { exportToXLSX } from "@/lib/export-utils";

export default function Purchases() {
  const { isAdmin } = useAuth();

  const { canCreate, canEdit, canDelete } = useModuleAccess("purchases");

  const { canEdit: canReturnEdit } = useModuleAccess("returns");

  const [selectedBranch, setSelectedBranch] = useState<string>("");

  const [statusFilter, setStatusFilter] = useState<string>("all");

  const [dialogOpen, setDialogOpen] = useState(false);

  const [detailsDialogPurchase, setDetailsDialogPurchase] =
    useState<Purchase | null>(null);

  const [editDialogPurchase, setEditDialogPurchase] = useState<Purchase | null>(
    null,
  );

  const [returnDialogPurchase, setReturnDialogPurchase] =
    useState<Purchase | null>(null);

  const { data: branches = [] } = useBranches();

  const { data: purchases = [], isLoading } = usePurchases(
    selectedBranch || undefined,
  );

  const deletePurchase = useDeletePurchase();

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 0,
    }).format(value);
  };

  /**
   * FILTERED PURCHASES
   */
  const filteredPurchases = useMemo(() => {
    return purchases.filter((p) => {
      if (statusFilter !== "all" && p.payment_status !== statusFilter) {
        return false;
      }

      return true;
    });
  }, [purchases, statusFilter]);

  /**
   * PAGINATION
   */
  const {
    paginatedItems: paginatedPurchases,
    currentPage,
    totalPages,
    totalItems,
    pageSize,
    goToPage,
    setPageSize,
  } = usePagination(filteredPurchases, 10);

  /**
   * RESET PAGE ON FILTER CHANGE
   */
  useEffect(() => {
    goToPage(1);
  }, [statusFilter, selectedBranch]);

  /**
   * SUMMARY STATS
   */
  const totalPurchases = filteredPurchases.reduce(
    (sum, p) => sum + Number(p.total_amount),
    0,
  );

  const totalPaid = filteredPurchases.reduce(
    (sum, p) => sum + Number(p.amount_paid),
    0,
  );

  const totalPending = totalPurchases - totalPaid;

  /**
   * PAYMENT BADGES
   */
  const getPaymentStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return (
          <Badge className="border-green-500/20 bg-green-500/10 text-green-600">
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Paid
          </Badge>
        );

      case "partial":
        return (
          <Badge className="border-yellow-500/20 bg-yellow-500/10 text-yellow-600">
            <AlertCircle className="mr-1 h-3 w-3" />
            Partial
          </Badge>
        );

      default:
        return (
          <Badge className="border-red-500/20 bg-red-500/10 text-red-600">
            <Clock className="mr-1 h-3 w-3" />
            Pending
          </Badge>
        );
    }
  };

  return (
    <DashboardLayout>
      <ModuleAccessGuard module="purchases">
        <div className="space-y-6 p-4 md:p-6">
          {/* HEADER */}
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-2xl font-bold">Purchases</h1>

              <p className="text-sm text-muted-foreground">
                Manage inventory purchases from suppliers
              </p>
            </div>

            {canCreate && (
              <Button
                onClick={() => setDialogOpen(true)}
                className="w-full bg-[#FF9E3D] font-bold text-[#000B26] hover:bg-[#e88d30] sm:w-auto"
              >
                <Plus className="mr-2 h-4 w-4" />
                New Purchase
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() =>
                exportToXLSX(
                  filteredPurchases.map((p: any) => ({
                    "PO Number": p.purchase_number,
                    Date: format(new Date(p.purchase_date || p.created_at), "yyyy-MM-dd"),
                    Supplier: p.suppliers?.name || "-",
                    Branch: p.branches?.name || "-",
                    Items: p.purchase_items?.length || 0,
                    Subtotal: Number(p.subtotal || 0),
                    Tax: Number(p.tax_amount || 0),
                    Total: Number(p.total_amount || 0),
                    "Amount Paid": Number(p.amount_paid || 0),
                    "Balance Due": Number((p.total_amount || 0) - (p.amount_paid || 0)),
                    "Payment Status": p.payment_status,
                  })),
                  "purchases",
                  "Purchases",
                )
              }
              disabled={filteredPurchases.length === 0}
            >
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Export Excel
            </Button>
          </div>

          {/* SUMMARY */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="rounded-lg bg-primary/10 p-3">
                    <Package className="h-6 w-6 text-primary" />
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground">
                      Total Purchases
                    </p>

                    <p className="text-2xl font-bold">
                      {formatCurrency(totalPurchases)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="rounded-lg bg-green-500/10 p-3">
                    <CheckCircle2 className="h-6 w-6 text-green-600" />
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground">Amount Paid</p>

                    <p className="text-2xl font-bold">
                      {formatCurrency(totalPaid)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="rounded-lg bg-red-500/10 p-3">
                    <DollarSign className="h-6 w-6 text-red-600" />
                  </div>

                  <div>
                    <p className="text-sm text-muted-foreground">
                      Pending Payment
                    </p>

                    <p className="text-2xl font-bold text-[#FF9E3D]">
                      {formatCurrency(totalPending)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* FILTERS */}
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Select
                  value={selectedBranch || "all"}
                  onValueChange={(value) =>
                    setSelectedBranch(value === "all" ? "" : value)
                  }
                >
                  <SelectTrigger className="w-full">
                    <Filter className="mr-2 h-4 w-4" />

                    <SelectValue placeholder="All Branches" />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value="all">All Branches</SelectItem>

                    {branches
                      .filter((branch) => branch.id)
                      .map((branch) => (
                        <SelectItem key={branch.id} value={branch.id}>
                          {branch.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>

                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full">
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
            </CardContent>
          </Card>

          {/* MOBILE VIEW */}
          <div className="grid gap-4 lg:hidden">
            {isLoading ? (
              <Card>
                <CardContent className="flex justify-center py-10">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </CardContent>
              </Card>
            ) : paginatedPurchases.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-muted-foreground">
                  No purchases found
                </CardContent>
              </Card>
            ) : (
              paginatedPurchases.map((purchase) => (
                <Card key={purchase.id}>
                  <CardContent className="space-y-4 pt-6">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">
                          {purchase.purchase_number}
                        </p>

                        <p className="text-sm text-muted-foreground">
                          {format(
                            new Date(purchase.purchase_date),
                            "MMM d, yyyy",
                          )}
                        </p>
                      </div>

                      {getPaymentStatusBadge(purchase.payment_status)}
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Supplier</span>

                        <span>{purchase.suppliers?.name || "—"}</span>
                      </div>

                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Branch</span>

                        <span>{purchase.branches?.name || "—"}</span>
                      </div>

                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Items</span>

                        <span>
                          {purchase.purchase_items?.length || 0} items
                        </span>
                      </div>

                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Total</span>

                        <span className="font-bold">
                          {formatCurrency(Number(purchase.total_amount))}
                        </span>
                      </div>
                    </div>

                    {isAdmin && (
                      <div className="flex flex-wrap gap-2 pt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setDetailsDialogPurchase(purchase)}
                        >
                          <Eye className="mr-1 h-4 w-4" />
                          View
                        </Button>

                        {canEdit && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setEditDialogPurchase(purchase)}
                          >
                            <Pencil className="mr-1 h-4 w-4" />
                            Edit
                          </Button>
                        )}

                        {canEdit && canReturnEdit && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setReturnDialogPurchase(purchase)}
                          >
                            <RotateCcw className="mr-1 h-4 w-4" />
                            Return
                          </Button>
                        )}

                        {canDelete && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="sm" variant="destructive">
                                <Trash2 className="mr-1 h-4 w-4" />
                                Delete
                              </Button>
                            </AlertDialogTrigger>

                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  Delete Purchase?
                                </AlertDialogTitle>

                                <AlertDialogDescription>
                                  This will delete {purchase.purchase_number}{" "}
                                  and reverse stock additions.
                                </AlertDialogDescription>
                              </AlertDialogHeader>

                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>

                                <AlertDialogAction
                                  className="bg-destructive text-destructive-foreground"
                                  onClick={() =>
                                    deletePurchase.mutate(purchase)
                                  }
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* DESKTOP TABLE */}
          <Card className="hidden lg:block">
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

                      {isAdmin && (
                        <TableHead className="w-[140px]">Actions</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {isLoading ? (
                      <TableRow>
                        <TableCell
                          colSpan={isAdmin ? 8 : 7}
                          className="py-10 text-center"
                        >
                          <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
                        </TableCell>
                      </TableRow>
                    ) : paginatedPurchases.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={isAdmin ? 8 : 7}
                          className="py-10 text-center text-muted-foreground"
                        >
                          No purchases found
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedPurchases.map((purchase) => (
                        <TableRow key={purchase.id} className="group">
                          <TableCell className="font-medium">
                            {purchase.purchase_number}

                            {purchase.reference_number && (
                              <span className="block text-xs text-muted-foreground">
                                Ref: {purchase.reference_number}
                              </span>
                            )}
                          </TableCell>

                          <TableCell>
                            {format(
                              new Date(purchase.purchase_date),
                              "MMM d, yyyy",
                            )}
                          </TableCell>

                          <TableCell>
                            {purchase.suppliers?.name || "—"}
                          </TableCell>

                          <TableCell>
                            {purchase.branches?.name || "—"}
                          </TableCell>

                          <TableCell>
                            {purchase.purchase_items?.length || 0} items
                          </TableCell>

                          <TableCell className="text-right font-semibold">
                            {formatCurrency(Number(purchase.total_amount))}
                          </TableCell>

                          <TableCell>
                            {getPaymentStatusBadge(purchase.payment_status)}
                          </TableCell>

                          {isAdmin && (
                            <TableCell>
                              <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() =>
                                    setDetailsDialogPurchase(purchase)
                                  }
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>

                                {canEdit && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() =>
                                      setEditDialogPurchase(purchase)
                                    }
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                )}

                                {canEdit && canReturnEdit && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() =>
                                      setReturnDialogPurchase(purchase)
                                    }
                                  >
                                    <RotateCcw className="h-4 w-4" />
                                  </Button>
                                )}

                                {canDelete && (
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-destructive"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </AlertDialogTrigger>

                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>
                                          Delete Purchase?
                                        </AlertDialogTitle>

                                        <AlertDialogDescription>
                                          This will delete{" "}
                                          {purchase.purchase_number} and reverse
                                          stock additions.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>

                                      <AlertDialogFooter>
                                        <AlertDialogCancel>
                                          Cancel
                                        </AlertDialogCancel>

                                        <AlertDialogAction
                                          className="bg-destructive text-destructive-foreground"
                                          onClick={() =>
                                            deletePurchase.mutate(purchase)
                                          }
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
              </div>

              {/* PAGINATION */}
              <div className="mt-6">
                <TablePagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalItems={totalItems}
                  pageSize={pageSize}
                  onPageChange={goToPage}
                  onPageSizeChange={setPageSize}
                />
              </div>
            </CardContent>
          </Card>

          {/* DIALOGS */}
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
        </div>
      </ModuleAccessGuard>
    </DashboardLayout>
  );
}
