import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { parseDbError } from '@/lib/db-errors';

export type PurchasePaymentStatus = 'pending' | 'partial' | 'paid';

export interface PurchaseItem {
  id: string;
  purchase_id: string;
  product_id: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  created_at: string;
  products?: {
    id: string;
    name: string;
    category: string;
    units?: {
      name: string;
      abbreviation: string | null;
    };
  };
}

export interface Purchase {
  id: string;
  organization_id: string;
  branch_id: string;
  supplier_id: string;
  purchase_number: string;
  purchase_date: string;
  reference_number: string | null;
  subtotal: number;
  total_amount: number;
  payment_status: PurchasePaymentStatus;
  amount_paid: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  branches?: {
    id: string;
    name: string;
  };
  suppliers?: {
    id: string;
    name: string;
  };
  purchase_items?: PurchaseItem[];
}

export interface PurchaseItemInput {
  product_id: string;
  quantity: number;
  unit_cost: number;
}

export interface PurchaseInput {
  branch_id: string;
  supplier_id: string;
  purchase_date?: string;
  reference_number?: string;
  payment_status?: PurchasePaymentStatus;
  amount_paid?: number;
  notes?: string;
  items: PurchaseItemInput[];
}

export function usePurchases(branchId?: string) {
  return useQuery({
    queryKey: ['purchases', branchId],
    queryFn: async () => {
      let query = supabase
        .from('purchases')
        .select(`
          *,
          branches (id, name),
          suppliers (id, name),
          purchase_items (
            id,
            product_id,
            quantity,
            unit_cost,
            total_cost,
            products (id, name, category, units (name, abbreviation))
          )
        `)
        .order('purchase_date', { ascending: false });

      if (branchId) {
        query = query.eq('branch_id', branchId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Purchase[];
    },
  });
}

export function useCreatePurchase() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: PurchaseInput & { organization_id: string }) => {
      // Generate purchase number
      const { data: purchaseNumber, error: numError } = await supabase
        .rpc('generate_purchase_number', { org_id: input.organization_id });

      if (numError) throw numError;

      // Calculate totals
      const subtotal = input.items.reduce((sum, item) => sum + (item.quantity * item.unit_cost), 0);
      const totalAmount = subtotal;

      // Create purchase record
      const { data: purchase, error: purchaseError } = await supabase
        .from('purchases')
        .insert({
          organization_id: input.organization_id,
          branch_id: input.branch_id,
          supplier_id: input.supplier_id,
          purchase_number: purchaseNumber,
          purchase_date: input.purchase_date || new Date().toISOString().split('T')[0],
          reference_number: input.reference_number,
          subtotal,
          total_amount: totalAmount,
          payment_status: input.payment_status || 'pending',
          amount_paid: input.amount_paid || 0,
          notes: input.notes,
          created_by: user?.id,
        })
        .select()
        .single();

      if (purchaseError) throw purchaseError;

      // Create purchase items
      const purchaseItems = input.items.map(item => ({
        purchase_id: purchase.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_cost: item.unit_cost,
        total_cost: item.quantity * item.unit_cost,
      }));

      const { error: itemsError } = await supabase
        .from('purchase_items')
        .insert(purchaseItems);

      if (itemsError) throw itemsError;

      // Update product stock levels and create stock history entries
      for (const item of input.items) {
        // Get current stock
        const { data: product, error: productError } = await supabase
          .from('products')
          .select('current_stock')
          .eq('id', item.product_id)
          .single();

        if (productError) throw productError;

        const previousStock = Number(product.current_stock);
        const newStock = previousStock + item.quantity;

        // Update product stock
        const { error: updateError } = await supabase
          .from('products')
          .update({ current_stock: newStock })
          .eq('id', item.product_id);

        if (updateError) throw updateError;

        // Create stock history entry
        const { error: historyError } = await supabase
          .from('stock_history')
          .insert({
            product_id: item.product_id,
            previous_stock: previousStock,
            new_stock: newStock,
            change_amount: item.quantity,
            change_type: 'purchase',
            notes: `Purchase ${purchaseNumber}`,
            changed_by: user?.id,
          });

        if (historyError) throw historyError;
      }

      return purchase;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['stock-history'] });
      toast({ title: 'Purchase recorded successfully' });
    },
    onError: (error: Error) => {
      const { title, description } = parseDbError(error, 'create purchase');
      toast({ title, description, variant: 'destructive' });
    },
  });
}

export function useUpdatePurchasePayment() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      id,
      payment_status,
      amount_paid,
    }: {
      id: string;
      payment_status: PurchasePaymentStatus;
      amount_paid: number;
    }) => {
      const { data, error } = await supabase
        .from('purchases')
        .update({ payment_status, amount_paid })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      toast({ title: 'Payment status updated' });
    },
    onError: (error: Error) => {
      const { title, description } = parseDbError(error, 'update payment');
      toast({ title, description, variant: 'destructive' });
    },
  });
}

export function useDeletePurchase() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (purchase: Purchase) => {
      // First, reverse the stock changes
      if (purchase.purchase_items) {
        for (const item of purchase.purchase_items) {
          // Get current stock
          const { data: product, error: productError } = await supabase
            .from('products')
            .select('current_stock')
            .eq('id', item.product_id)
            .single();

          if (productError) throw productError;

          const previousStock = Number(product.current_stock);
          const newStock = previousStock - item.quantity;

          // Update product stock (allow negative for correction)
          const { error: updateError } = await supabase
            .from('products')
            .update({ current_stock: Math.max(0, newStock) })
            .eq('id', item.product_id);

          if (updateError) throw updateError;

          // Create stock history entry for reversal
          const { error: historyError } = await supabase
            .from('stock_history')
            .insert({
              product_id: item.product_id,
              previous_stock: previousStock,
              new_stock: Math.max(0, newStock),
              change_amount: -item.quantity,
              change_type: 'purchase_reversal',
              notes: `Deleted purchase ${purchase.purchase_number}`,
              changed_by: user?.id,
            });

          if (historyError) throw historyError;
        }
      }

      // Delete the purchase (cascade will handle items)
      const { error } = await supabase
        .from('purchases')
        .delete()
        .eq('id', purchase.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['stock-history'] });
      toast({ title: 'Purchase deleted and stock reversed' });
    },
    onError: (error: Error) => {
      const { title, description } = parseDbError(error, 'delete purchase');
      toast({ title, description, variant: 'destructive' });
    },
  });
}
