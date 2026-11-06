import { useState } from "react";
import { format } from "date-fns";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePurchasePayments, useRecordPurchasePayment } from "@/hooks/usePurchases";
import { useToast } from "@/hooks/use-toast";

interface PurchasePaymentRecorderProps {
  purchaseId: string;
  totalAmount: number;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
  }).format(value);
}

export function PurchasePaymentRecorder({
  purchaseId,
  totalAmount,
}: PurchasePaymentRecorderProps) {
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const { data: payments = [], isLoading, isError } = usePurchasePayments(purchaseId);
  const recordPayment = useRecordPurchasePayment();
  const { toast } = useToast();
  const totalPaid = payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
  const balanceDue = Math.max(0, totalAmount - totalPaid);

  const handleRecordPayment = async () => {
    const amount = Number(paymentAmount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > balanceDue) {
      toast({
        title: "Invalid payment amount",
        description: `Enter an amount greater than zero and no more than ${formatCurrency(balanceDue)}.`,
        variant: "destructive",
      });
      return;
    }

    if (!paymentDate) {
      toast({
        title: "Payment date required",
        description: "Choose the date the payment was made.",
        variant: "destructive",
      });
      return;
    }

    await recordPayment.mutateAsync({
      purchase_id: purchaseId,
      amount,
      payment_date: paymentDate,
    });
    setPaymentAmount("");
    setPaymentDate(format(new Date(), "yyyy-MM-dd"));
  };

  return (
    <div className="space-y-4 rounded-md border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">Record Payment</h3>
        <p className="text-sm text-muted-foreground">
          Paid: {formatCurrency(totalPaid)} · Balance: {formatCurrency(balanceDue)}
        </p>
      </div>

      {isError ? (
        <p className="text-sm text-destructive">
          Could not load payment history. Please try again.
        </p>
      ) : isLoading ? (
        <p className="text-sm text-muted-foreground">Loading payments...</p>
      ) : balanceDue > 0 ? (
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <div className="space-y-2">
            <Label htmlFor="edit-purchase-payment-amount">Payment Amount</Label>
            <Input
              id="edit-purchase-payment-amount"
              type="number"
              min="0.01"
              max={balanceDue}
              step="0.01"
              value={paymentAmount}
              onChange={(event) => setPaymentAmount(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-purchase-payment-date">Payment Date</Label>
            <Input
              id="edit-purchase-payment-date"
              type="date"
              value={paymentDate}
              onChange={(event) => setPaymentDate(event.target.value)}
            />
          </div>
          <Button
            onClick={handleRecordPayment}
            disabled={recordPayment.isPending || isLoading || isError}
          >
            {recordPayment.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Recording...
              </>
            ) : (
              "Record Payment"
            )}
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">This purchase is fully paid.</p>
      )}
    </div>
  );
}
