import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { parseDbError } from '@/lib/db-errors';

export interface SaleReturn {
  id: string;
  organization_id: string;
  sale_id: string;
  branch_id: string | null;
  return_number: string;
  return_date: string;
  total_amount: number;
  refund_method: string;
  reason: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  sales?: { id: string; sale_number: string };
  branches?: { id: string; name: string };
  sale_return_items?: SaleReturnItem[];
}

export interface SaleReturnItem {
  id: string;
  return_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  products?: { id: string; name: string };
}

export function useSaleReturns() {
  return useQuery({
    queryKey: ['sale-returns'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sale_returns')
        .select(`*, sales(id, sale_number), branches(id, name), sale_return_items(*, products(id, name))`)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as SaleReturn[];
    },
  });
}

export function useAlreadyReturnedQuantities(saleId: string | undefined) {
  return useQuery({
    queryKey: ['sale-returned-quantities', saleId],
    enabled: !!saleId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sale_return_items')
        .select('product_id, quantity, sale_returns!inner(sale_id)')
        .eq('sale_returns.sale_id', saleId!);
      if (error) throw error;
      const map: Record<string, number> = {};
      for (const item of (data || [])) {
        map[item.product_id] = (map[item.product_id] || 0) + Number(item.quantity);
      }
      return map;
    },
  });
}

export function useUndoSaleReturn() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (ret: SaleReturn) => {
      // Reverse stock for each returned item
      for (const item of (ret.sale_return_items || [])) {
        const { data: product } = await supabase
          .from('products')
          .select('current_stock, item_type')
          .eq('id', item.product_id)
          .single();

        if (product && product.item_type === 'product') {
          const prev = Number(product.current_stock);
          const newStock = Math.max(0, prev - item.quantity);
          await supabase.from('products').update({ current_stock: newStock }).eq('id', item.product_id);
          await supabase.from('stock_history').insert({
            product_id: item.product_id,
            previous_stock: prev,
            new_stock: newStock,
            change_amount: -item.quantity,
            change_type: 'sale_return',
            notes: `Undo sale return ${ret.return_number}`,
            changed_by: user?.id,
          });
        }
      }

      // Reverse balance adjustment on outstanding/partial sales
      const { data: sale } = await supabase
        .from('sales')
        .select('total_amount, amount_paid, balance_due, payment_status')
        .eq('id', ret.sale_id)
        .single();

      if (sale && (sale.payment_status === 'partial' || sale.payment_status === 'outstanding' || sale.payment_status === 'paid')) {
        const newTotal = Number(sale.total_amount) + ret.total_amount;
        const newBalance = newTotal - Number(sale.amount_paid);
        const newStatus = newBalance <= 0 ? 'paid' : Number(sale.amount_paid) > 0 ? 'partial' : 'outstanding';
        await supabase.from('sales').update({
          total_amount: newTotal,
          balance_due: Math.max(0, newBalance),
          payment_status: newStatus,
        }).eq('id', ret.sale_id);
      }

      // Delete return items then return
      await supabase.from('sale_return_items').delete().eq('return_id', ret.id);
      const { error } = await supabase.from('sale_returns').delete().eq('id', ret.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sale-returns'] });
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['outstanding-sales'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['stock-history'] });
      queryClient.invalidateQueries({ queryKey: ['sale-returned-quantities'] });
      toast({ title: 'Sale return undone successfully' });
    },
    onError: (error: Error) => {
      const { title, description } = parseDbError(error, 'undo sale return');
      toast({ title, description, variant: 'destructive' });
    },
  });
}

export function useCreateSaleReturn() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: {
      organization_id: string;
      sale_id: string;
      branch_id?: string | null;
      refund_method?: string;
      reason?: string;
      notes?: string;
      items: { product_id: string; quantity: number; unit_price: number }[];
    }) => {
      const { data: returnNumber, error: numErr } = await supabase
        .rpc('generate_sale_return_number', { org_id: input.organization_id });
      if (numErr) throw numErr;

      const totalAmount = input.items.reduce((s, i) => s + i.quantity * i.unit_price, 0);

      const { data: ret, error: retErr } = await supabase
        .from('sale_returns')
        .insert({
          organization_id: input.organization_id,
          sale_id: input.sale_id,
          branch_id: input.branch_id || null,
          return_number: returnNumber,
          total_amount: totalAmount,
          refund_method: input.refund_method || 'cash',
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
        unit_price: i.unit_price,
        total_price: i.quantity * i.unit_price,
      }));

      const { error: itemsErr } = await supabase.from('sale_return_items').insert(items);
      if (itemsErr) throw itemsErr;

      // Restore stock for returned items
      for (const item of input.items) {
        const { data: product } = await supabase
          .from('products')
          .select('current_stock, item_type')
          .eq('id', item.product_id)
          .single();

        if (product && product.item_type === 'product') {
          const prev = Number(product.current_stock);
          const newStock = prev + item.quantity;

          await supabase.from('products').update({ current_stock: newStock }).eq('id', item.product_id);
          await supabase.from('stock_history').insert({
            product_id: item.product_id,
            previous_stock: prev,
            new_stock: newStock,
            change_amount: item.quantity,
            change_type: 'sale_return',
            notes: `Sale return ${returnNumber}`,
            changed_by: user?.id,
          });
        }
      }

      return ret;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sale-returns'] });
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['stock-history'] });
      queryClient.invalidateQueries({ queryKey: ['sale-returned-quantities'] });
      toast({ title: 'Sale return recorded' });
    },
    onError: (error: Error) => {
      const { title, description } = parseDbError(error, 'create sale return');
      toast({ title, description, variant: 'destructive' });
    },
  });
}
