import { useState, useEffect } from 'react';
import { Plus, Trash2, CreditCard, Banknote, Smartphone, Building, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
 import { formatCurrency } from '@/lib/currency';
import type { PaymentMethod } from '@/hooks/useSales';

export interface PaymentSplit {
  method: PaymentMethod;
  amount: number;
}

interface SplitPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  totalAmount: number;
  payments: PaymentSplit[];
  onPaymentsChange: (payments: PaymentSplit[]) => void;
  onConfirm: () => void;
  isLoading?: boolean;
}

const paymentMethodLabels: Record<PaymentMethod, { label: string; icon: React.ReactNode }> = {
  cash: { label: 'Cash', icon: <Banknote className="h-4 w-4" /> },
  card: { label: 'Card', icon: <CreditCard className="h-4 w-4" /> },
  mobile_money: { label: 'Mobile Money', icon: <Smartphone className="h-4 w-4" /> },
  bank_transfer: { label: 'Bank Transfer', icon: <Building className="h-4 w-4" /> },
  credit: { label: 'Credit', icon: <Clock className="h-4 w-4" /> },
};

export function SplitPaymentDialog({
  open,
  onOpenChange,
  totalAmount,
  payments,
  onPaymentsChange,
  onConfirm,
  isLoading,
}: SplitPaymentDialogProps) {
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const remaining = totalAmount - totalPaid;
  const isBalanced = Math.abs(remaining) < 0.01;

  const addPayment = () => {
    const newPayment: PaymentSplit = {
      method: 'cash',
      amount: Math.max(0, remaining),
    };
    onPaymentsChange([...payments, newPayment]);
  };

  const removePayment = (index: number) => {
    onPaymentsChange(payments.filter((_, i) => i !== index));
  };

  const updatePayment = (index: number, updates: Partial<PaymentSplit>) => {
    const newPayments = [...payments];
    newPayments[index] = { ...newPayments[index], ...updates };
    onPaymentsChange(newPayments);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Split Payment</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Summary */}
          <div className="bg-muted p-3 rounded-lg space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Amount</span>
               <span className="font-semibold">{formatCurrency(totalAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Amount Paid</span>
               <span className="font-medium">{formatCurrency(totalPaid)}</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Remaining</span>
              <span className={cn(
                "font-semibold",
                remaining > 0 ? "text-destructive" : remaining < 0 ? "text-warning" : "text-accent-foreground"
              )}>
                 {remaining > 0 ? formatCurrency(remaining) : remaining < 0 ? `Over by ${formatCurrency(Math.abs(remaining))}` : 'Balanced'}
              </span>
            </div>
          </div>

          {/* Payment Lines */}
          <div className="space-y-3">
            <Label>Payment Methods</Label>
            {payments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No payments added. Click "Add Payment" below.
              </p>
            ) : (
              payments.map((payment, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Select
                    value={payment.method}
                    onValueChange={(value: PaymentMethod) => updatePayment(index, { method: value })}
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(paymentMethodLabels).map(([value, { label, icon }]) => (
                        <SelectItem key={value} value={value}>
                          <div className="flex items-center gap-2">
                            {icon}
                            <span>{label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                   <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={payment.amount || ''}
                    onChange={(e) => updatePayment(index, { amount: e.target.value === '' ? 0 : Number(e.target.value) })}
                    className="flex-1"
                    placeholder="Amount"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive shrink-0"
                    onClick={() => removePayment(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
            )}
            <Button variant="outline" onClick={addPayment} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Add Payment
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={onConfirm} 
            disabled={!isBalanced || payments.length === 0 || isLoading}
          >
            {isLoading ? 'Processing...' : 'Confirm Payment'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}