import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  FileText,
  Pencil,
  Save,
  Trash2,
  X,
} from "lucide-react";
import {
  type PurchasePayment,
  type Purchase,
  usePurchasePayments,
  useUpdatePurchasePayment,
  useDeletePurchasePayment,
  getPurchaseReceiptUrl,
} from "@/hooks/usePurchases";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/lib/auth";
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

interface PurchaseDetailsDialogProps {
  purchase: Purchase;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PurchaseDetailsDialog({
  purchase,
  open,
  onOpenChange,
}: PurchaseDetailsDialogProps) {
  const {
    data: payments = [],
    isLoading: paymentsLoading,
    isError: paymentsError,
  } = usePurchasePayments(purchase.id);
  const updatePayment = useUpdatePurchasePayment();
  const deletePayment = useDeletePurchasePayment();
  const { toast } = useToast();
  const { isAdmin, isSuperAdmin } = useAuth();
  const canManagePayments = isAdmin || isSuperAdmin;
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [editingPaymentAmount, setEditingPaymentAmount] = useState("");
  const [editingPaymentDate, setEditingPaymentDate] = useState("");
  const [paymentToDelete, setPaymentToDelete] =
    useState<PurchasePayment | null>(null);
  const totalPaid = payments.reduce(
    (sum, payment) => sum + Number(payment.amount),
    0,
  );
  const balanceDue = Math.max(0, Number(purchase.total_amount) - totalPaid);
  const paymentStatus =
    totalPaid <= 0 ? "pending" :
    totalPaid >= Number(purchase.total_amount) ? "paid" : "partial";

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const getPaymentStatusBadge = (status: string) => {
    switch (status) {
      case "paid":
        return (
          <Badge className="bg-green-500/10 text-green-600 border-green-500/20">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Paid
          </Badge>
        );
      case "partial":
        return (
          <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-500/20">
            <AlertCircle className="h-3 w-3 mr-1" />
            Partial
          </Badge>
        );
      default:
        return (
          <Badge className="bg-red-500/10 text-red-600 border-red-500/20">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
    }
  };

  const beginEditPayment = (payment: PurchasePayment) => {
    setEditingPaymentId(payment.id);
    setEditingPaymentAmount(String(payment.amount));
    setEditingPaymentDate(payment.payment_date || "");
  };

  const cancelEditPayment = () => {
    setEditingPaymentId(null);
    setEditingPaymentAmount("");
    setEditingPaymentDate("");
  };

  const handleUpdatePayment = (payment: PurchasePayment) => {
    const amount = Number(editingPaymentAmount);
    const maximumAmount = balanceDue + Number(payment.amount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > maximumAmount) {
      toast({
        title: "Invalid payment amount",
        description: `Enter an amount greater than zero and no more than ${formatCurrency(maximumAmount)}.`,
        variant: "destructive",
      });
      return;
    }

    if (!editingPaymentDate) {
      toast({
        title: "Payment date required",
        description: "Choose the date the payment was made.",
        variant: "destructive",
      });
      return;
    }

    updatePayment.mutate(
      {
        id: payment.id,
        purchase_id: purchase.id,
        amount,
        payment_date: editingPaymentDate,
      },
      { onSuccess: cancelEditPayment },
    );
  };

  const handleDeletePayment = () => {
    if (!paymentToDelete) return;
    deletePayment.mutate(
      {
        id: paymentToDelete.id,
        purchaseId: purchase.id,
      },
      { onSuccess: () => setPaymentToDelete(null) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Purchase {purchase.purchase_number}</span>
            {getPaymentStatusBadge(paymentStatus)}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Details */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Supplier</p>
              <p className="font-medium">{purchase.suppliers?.name || "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Branch</p>
              <p className="font-medium">{purchase.branches?.name || "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Purchase Date</p>
              <p className="font-medium">
                {format(new Date(purchase.purchase_date), "MMMM d, yyyy")}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Reference Number</p>
              <p className="font-medium">{purchase.reference_number || "—"}</p>
            </div>
          </div>

          <Separator />

          {/* Items */}
          <div>
            <h3 className="font-semibold mb-3">Items</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead>Batch Number</TableHead>
                  <TableHead>Expiry Date</TableHead>
                  <TableHead className="text-right">Unit Cost</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchase.purchase_items?.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">
                      {item.products?.name || "Unknown Product"}
                      {item.product_variations?.sku && (
                        <span className="block text-xs text-muted-foreground">
                          Variation: {item.product_variations.sku}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          item.products?.category === "sellable"
                            ? "default"
                            : "secondary"
                        }
                      >
                        {item.products?.category || "—"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {Number(item.quantity).toLocaleString()}{" "}
                      {item.products?.units?.abbreviation}
                    </TableCell>
                    <TableCell>{item.batch_number || "—"}</TableCell>
                    <TableCell>
                      {item.expiration_date
                        ? format(new Date(`${item.expiration_date}T00:00:00`), "MMMM d, yyyy")
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(Number(item.unit_cost))}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(Number(item.total_cost))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <Separator />

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-64 space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(Number(purchase.subtotal))}</span>
              </div>
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span>{formatCurrency(Number(purchase.total_amount))}</span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Payment Update */}
          <div className="space-y-4">
            <h3 className="font-semibold">Payment Details</h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Total Paid</Label>
                <p className="flex h-10 items-center font-medium">
                  {formatCurrency(totalPaid)}
                </p>
              </div>
              <div className="space-y-2">
                <Label>Balance Due</Label>
                <p className="flex h-10 items-center font-medium">
                  {formatCurrency(balanceDue)}
                </p>
              </div>
              <div className="space-y-2">
                <Label>Payment Status</Label>
                <div className="flex h-10 items-center">
                  {getPaymentStatusBadge(paymentStatus)}
                </div>
              </div>
            </div>

            <div>
              <h4 className="mb-2 text-sm font-medium">Payment History</h4>
              {paymentsError ? (
                <p className="text-sm text-destructive">
                  Could not load payment history. Please try again.
                </p>
              ) : paymentsLoading ? (
                <p className="text-sm text-muted-foreground">Loading payments...</p>
              ) : payments.length === 0 ? (
                <p className="text-sm text-muted-foreground">No payments recorded.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Payment Date</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      {canManagePayments && (
                        <TableHead className="text-right">Actions</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell>
                          {editingPaymentId === payment.id ? (
                            <Input
                              aria-label="Edit payment date"
                              type="date"
                              value={editingPaymentDate}
                              onChange={(event) => setEditingPaymentDate(event.target.value)}
                            />
                          ) : payment.payment_date ? (
                            format(new Date(`${payment.payment_date}T00:00:00`), "MMMM d, yyyy")
                          ) : (
                            "Date not recorded"
                          )}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {editingPaymentId === payment.id ? (
                            <Input
                              aria-label="Edit payment amount"
                              type="number"
                              min="0.01"
                              max={balanceDue + Number(payment.amount)}
                              step="0.01"
                              className="ml-auto max-w-40 text-right"
                              value={editingPaymentAmount}
                              onChange={(event) => setEditingPaymentAmount(event.target.value)}
                            />
                          ) : (
                            formatCurrency(Number(payment.amount))
                          )}
                        </TableCell>
                        {canManagePayments && (
                          <TableCell className="text-right">
                            {editingPaymentId === payment.id ? (
                              <div className="flex justify-end gap-1">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  aria-label="Save payment changes"
                                  disabled={updatePayment.isPending}
                                  onClick={() => handleUpdatePayment(payment)}
                                >
                                  {updatePayment.isPending
                                    ? <Loader2 className="h-4 w-4 animate-spin" />
                                    : <Save className="h-4 w-4" />}
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  aria-label="Cancel payment edit"
                                  onClick={cancelEditPayment}
                                  disabled={updatePayment.isPending}
                                >
                                  <X className="h-4 w-4" />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex justify-end gap-1">
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  aria-label="Edit payment"
                                  onClick={() => beginEditPayment(payment)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="text-destructive"
                                  aria-label="Delete payment"
                                  onClick={() => setPaymentToDelete(payment)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>

          </div>

          {/* Notes */}
          {purchase.notes && (
            <>
              <Separator />
              <div>
                <h3 className="font-semibold mb-2">Notes</h3>
                <p className="text-sm text-muted-foreground">
                  {purchase.notes}
                </p>
              </div>
            </>
          )}

          {purchase.receipt_url && (
            <>
              <Separator />
              <div>
                <h3 className="font-semibold mb-2">Receipt</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      const url = await getPurchaseReceiptUrl(
                        purchase.receipt_url!,
                      );
                      window.open(url, "_blank", "noopener,noreferrer");
                    } catch (e: any) {
                      toast({
                        title: "Could not open receipt",
                        description: e?.message ?? "Unknown error",
                        variant: "destructive",
                      });
                    }
                  }}
                >
                  <FileText className="h-4 w-4 mr-1" /> View Receipt
                </Button>
              </div>
            </>
          )}
        </div>
      </DialogContent>
      <AlertDialog
        open={paymentToDelete !== null}
        onOpenChange={(open) => {
          if (!open && !deletePayment.isPending) setPaymentToDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this payment?</AlertDialogTitle>
            <AlertDialogDescription>
              This payment will be removed from the purchase history and the
              purchase balance and status will be recalculated.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletePayment.isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deletePayment.isPending}
              onClick={(event) => {
                event.preventDefault();
                handleDeletePayment();
              }}
            >
              {deletePayment.isPending ? "Deleting..." : "Delete payment"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
