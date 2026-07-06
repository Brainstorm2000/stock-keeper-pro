import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { parseDbError } from '@/lib/db-errors';

export interface DebtPayment {
  id: string;
  organization_id: string;
  sale_id: string;
  amount: number;
  payment_method: string;
  payment_method_id?: string | null;
  notes: string | null;
  paid_by: string | null;
  created_at: string;
}

export function useOutstandingSales() {
  return useQuery({
    queryKey: ['outstanding-sales'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales')
        .select('*')
        .in('payment_status', ['partial', 'outstanding'])
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useDebtPayments(saleId: string | null) {
  return useQuery({
    queryKey: ['debt-payments', saleId],
    queryFn: async () => {
      if (!saleId) return [];
      const { data, error } = await supabase
        .from('debt_payments')
        .select('*')
        .eq('sale_id', saleId)
        .order('created_at', { ascending: true });
      if (error) throw error;
      return data as DebtPayment[];
    },
    enabled: !!saleId,
  });
}

export function useRecordDebtPayment() {
  const queryClient = useQueryClient();
  const { user, organizationId } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      saleId,
      amount,
      paymentMethod,
      paymentMethodId,
      notes,
      payments,
    }: {
      saleId: string;
      amount?: number;
      paymentMethod?: string;
      paymentMethodId?: string | null;
      notes?: string;
      payments?: { amount: number; paymentMethod: string; paymentMethodId?: string | null; notes?: string }[];
    }) => {
      if (!organizationId) throw new Error('No organization');

      const splits =
        payments && payments.length > 0
          ? payments.filter((p) => p.amount > 0)
          : amount && paymentMethod
            ? [{ amount, paymentMethod, paymentMethodId, notes }]
            : [];
      if (splits.length === 0) throw new Error('No payment amount provided');
      const totalPaidNow = splits.reduce((s, p) => s + Number(p.amount || 0), 0);

      // Get current sale
      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .select('amount_paid, balance_due, total_amount')
        .eq('id', saleId)
        .single();
      if (saleError) throw saleError;

      const newAmountPaid = Number(sale.amount_paid) + totalPaidNow;
      const newBalance = Number(sale.total_amount) - newAmountPaid;
      const newStatus = newBalance <= 0 ? 'paid' : 'partial';

      // Insert debt payment record(s)
      const { error: paymentError } = await supabase
        .from('debt_payments')
        .insert(
          splits.map((p) => ({
            organization_id: organizationId,
            sale_id: saleId,
            amount: p.amount,
            payment_method: p.paymentMethod,
            payment_method_id: (p as any).paymentMethodId ?? null,
            notes: p.notes || notes || null,
            paid_by: user?.id || null,
          })) as any,
        );
      if (paymentError) throw paymentError;

      // Update sale
      const { error: updateError } = await supabase
        .from('sales')
        .update({
          amount_paid: newAmountPaid,
          balance_due: Math.max(0, newBalance),
          payment_status: newStatus,
        })
        .eq('id', saleId);
      if (updateError) throw updateError;

      return { newStatus, newBalance: Math.max(0, newBalance) };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['outstanding-sales'] });
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['debt-payments'] });
      toast({
        title: data.newStatus === 'paid' ? 'Debt fully paid!' : 'Payment recorded',
        description: data.newStatus === 'paid' ? 'This sale is now fully paid.' : `Remaining balance: ${data.newBalance.toFixed(2)}`,
      });
    },
    onError: (error: Error) => {
      const { title, description } = parseDbError(error, 'record payment');
      toast({ title, description, variant: 'destructive' });
    },
  });
}
