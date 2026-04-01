import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { parseDbError } from '@/lib/db-errors';

export interface PurchaseReturn {
  id: string;
  organization_id: string;
  purchase_id: string;
  branch_id: string;
  return_number: string;
  return_date: string;
  total_amount: number;
  reason: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  purchases?: { id: string; purchase_number: string };
  branches?: { id: string; name: string };
  purchase_return_items?: PurchaseReturnItem[];
}

export interface PurchaseReturnItem {
  id: string;
  return_id: string;
  product_id: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  products?: { id: string; name: string; units?: { name: string; abbreviation: string | null } };
}

export function usePurchaseReturns() {
  return useQuery({
    queryKey: ['purchase-returns'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('purchase_returns')
        .select(`*, purchases(id, purchase_number), branches(id, name), purchase_return_items(*, products(id, name, units(name, abbreviation)))`)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as PurchaseReturn[];
    },
  });
}

export function useCreatePurchaseReturn() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: {
      organization_id: string;
      purchase_id: string;
      branch_id: string;
      reason?: string;
      notes?: string;
      items: { product_id: string; quantity: number; unit_cost: number }[];
    }) => {
      const { data: returnNumber, error: numErr } = await supabase
        .rpc('generate_purchase_return_number', { org_id: input.organization_id });
      if (numErr) throw numErr;

      const totalAmount = input.items.reduce((s, i) => s + i.quantity * i.unit_cost, 0);

      const { data: ret, error: retErr } = await supabase
        .from('purchase_returns')
        .insert({
          organization_id: input.organization_id,
          purchase_id: input.purchase_id,
          branch_id: input.branch_id,
          return_number: returnNumber,
          total_amount: totalAmount,
          reason: input.reason || null,
          notes: input.notes || null,
          created_by: user?.id,
        })
        .select()
        .single();
      if (retErr) throw retErr;

      const items = input.items.map(i => ({
        return_id: ret.id,
        product_id: i.product_id,
        quantity: i.quantity,
        unit_cost: i.unit_cost,
        total_cost: i.quantity * i.unit_cost,
      }));

      const { error: itemsErr } = await supabase.from('purchase_return_items').insert(items);
      if (itemsErr) throw itemsErr;

      // Reverse stock for returned items
      for (const item of input.items) {
        const { data: product } = await supabase
          .from('products')
          .select('current_stock')
          .eq('id', item.product_id)
          .single();

        if (product) {
          const prev = Number(product.current_stock);
          const newStock = Math.max(0, prev - item.quantity);

          await supabase.from('products').update({ current_stock: newStock }).eq('id', item.product_id);
          await supabase.from('stock_history').insert({
            product_id: item.product_id,
            previous_stock: prev,
            new_stock: newStock,
            change_amount: -item.quantity,
            change_type: 'purchase_return',
            notes: `Purchase return ${returnNumber}`,
            changed_by: user?.id,
          });
        }
      }

      return ret;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-returns'] });
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['stock-history'] });
      toast({ title: 'Purchase return recorded' });
    },
    onError: (error: Error) => {
      const { title, description } = parseDbError(error, 'create purchase return');
      toast({ title, description, variant: 'destructive' });
    },
  });
}
