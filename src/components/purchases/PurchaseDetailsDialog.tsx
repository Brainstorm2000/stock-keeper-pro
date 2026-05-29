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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  FileText,
} from "lucide-react";
import {
  type Purchase,
  type PurchasePaymentStatus,
  useUpdatePurchasePayment,
  getPurchaseReceiptUrl,
} from "@/hooks/usePurchases";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

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
  const [paymentStatus, setPaymentStatus] = useState<PurchasePaymentStatus>(
    purchase.payment_status,
  );
  const [amountPaid, setAmountPaid] = useState(String(purchase.amount_paid));
  const updatePayment = useUpdatePurchasePayment();
  const { toast } = useToast();

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

  const handleUpdatePayment = async () => {
    await updatePayment.mutateAsync({
      id: purchase.id,
      payment_status: paymentStatus,
      amount_paid: Number(amountPaid) || 0,
    });
  };

  const hasPaymentChanges =
    paymentStatus !== purchase.payment_status ||
    amountPaid !== String(purchase.amount_paid);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Purchase {purchase.purchase_number}</span>
            {getPaymentStatusBadge(purchase.payment_status)}
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
                  <TableHead className="text-right">Unit Cost</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchase.purchase_items?.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">
                      {item.products?.name || "Unknown Product"}
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Payment Status</Label>
                <Select
                  value={paymentStatus}
                  onValueChange={(v) =>
                    setPaymentStatus(v as PurchasePaymentStatus)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="partial">Partial</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Amount Paid</Label>
                <Input
                  type="number"
                  min="0"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                />
              </div>
            </div>

            <div className="flex justify-between items-center">
              <div className="text-sm text-muted-foreground">
                Balance:{" "}
                {formatCurrency(
                  Number(purchase.total_amount) - (Number(amountPaid) || 0),
                )}
              </div>
              {hasPaymentChanges && (
                <Button
                  onClick={handleUpdatePayment}
                  disabled={updatePayment.isPending}
                >
                  {updatePayment.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Update Payment"
                  )}
                </Button>
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
    </Dialog>
  );
}
