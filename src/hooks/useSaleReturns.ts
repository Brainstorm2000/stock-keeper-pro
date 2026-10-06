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
  variation_id: string | null;
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
        .select('product_id, variation_id, quantity, sale_returns!inner(sale_id)')
        .eq('sale_returns.sale_id', saleId!);
      if (error) throw error;
      const map: Record<string, number> = {};
      for (const item of (data || [])) {
        const key = `${item.product_id}:${item.variation_id || ''}`;
        map[key] = (map[key] || 0) + Number(item.quantity);
      }
      return map;
    },
  });
}

export function useUndoSaleReturn() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (ret: SaleReturn) => {
      for (const item of (ret.sale_return_items || [])) {
        const { error } = await supabase.rpc('adjust_sale_return_stock', {
          _product_id: item.product_id,
          _variation_id: item.variation_id,
          _change_amount: -Number(item.quantity),
          _return_number: `Undo ${ret.return_number}`,
          _permission: 'delete',
        });
        if (error) throw error;
      }

      const { error: creditError } = await supabase.rpc('sync_sale_return_debt_credit', {
        _return_id: ret.id,
        _permission: 'delete',
        _total_override: 0,
      });
      if (creditError) throw creditError;

      const { error: itemsError } = await supabase.from('sale_return_items').delete().eq('return_id', ret.id);
      if (itemsError) throw itemsError;
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
      queryClient.invalidateQueries({ queryKey: ['debt-payments'] });
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
      items: { product_id: string; variation_id?: string | null; quantity: number; unit_price: number }[];
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
        variation_id: i.variation_id || null,
        quantity: i.quantity,
        unit_price: i.unit_price,
        total_price: i.quantity * i.unit_price,
      }));

      const { error: itemsErr } = await supabase.from('sale_return_items').insert(items);
      if (itemsErr) throw itemsErr;

      for (const item of input.items) {
        const { error } = await supabase.rpc('adjust_sale_return_stock', {
          _product_id: item.product_id,
          _variation_id: item.variation_id || null,
          _change_amount: item.quantity,
          _return_number: returnNumber,
          _permission: 'create',
        });
        if (error) throw error;
      }

      const { error: creditError } = await supabase.rpc('sync_sale_return_debt_credit', {
        _return_id: ret.id,
        _permission: 'create',
      });
      if (creditError) throw creditError;

      return ret;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sale-returns'] });
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['outstanding-sales'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['stock-history'] });
      queryClient.invalidateQueries({ queryKey: ['sale-returned-quantities'] });
      queryClient.invalidateQueries({ queryKey: ['debt-payments'] });
      toast({ title: 'Sale return recorded' });
    },
    onError: (error: Error) => {
      const { title, description } = parseDbError(error, 'create sale return');
      toast({ title, description, variant: 'destructive' });
    },
  });
}

export function useUpdateSaleReturn() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: {
      saleReturn: SaleReturn;
      refund_method: string;
      return_date: string;
      reason: string | null;
      notes: string | null;
      items: { product_id: string; variation_id: string | null; quantity: number; unit_price: number }[];
    }) => {
      const { saleReturn, items } = input;
      if (items.length === 0) throw new Error('A sale return must contain at least one item.');

      const { data: saleItems, error: saleItemsError } = await supabase
        .from('sale_items')
        .select('product_id, variation_id, quantity')
        .eq('sale_id', saleReturn.sale_id);
      if (saleItemsError) throw saleItemsError;

      const { data: otherReturnItems, error: otherItemsError } = await supabase
        .from('sale_return_items')
        .select('product_id, variation_id, quantity, sale_returns!inner(sale_id)')
        .eq('sale_returns.sale_id', saleReturn.sale_id)
        .neq('return_id', saleReturn.id);
      if (otherItemsError) throw otherItemsError;

      const itemKey = (productId: string, variationId: string | null) => `${productId}:${variationId || ''}`;
      const soldQuantities = new Map<string, number>();
      const otherReturnedQuantities = new Map<string, number>();
      for (const item of saleItems || []) {
        const key = itemKey(item.product_id, item.variation_id);
        soldQuantities.set(key, (soldQuantities.get(key) || 0) + Number(item.quantity));
      }
      for (const item of otherReturnItems || []) {
        const key = itemKey(item.product_id, item.variation_id);
        otherReturnedQuantities.set(key, (otherReturnedQuantities.get(key) || 0) + Number(item.quantity));
      }

      const newQuantities = new Map<string, number>();
      for (const item of items) {
        if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
          throw new Error('Return quantities must be greater than zero.');
        }
        const key = itemKey(item.product_id, item.variation_id);
        newQuantities.set(key, (newQuantities.get(key) || 0) + item.quantity);
      }
      for (const [key, quantity] of newQuantities) {
        const maximum = (soldQuantities.get(key) || 0) - (otherReturnedQuantities.get(key) || 0);
        if (quantity > maximum) throw new Error('Return quantity cannot exceed the quantity sold and not already returned.');
      }

      const oldItems = saleReturn.sale_return_items || [];
      const oldQuantities = new Map<string, number>();
      for (const item of oldItems) {
        const key = itemKey(item.product_id, item.variation_id || null);
        oldQuantities.set(key, (oldQuantities.get(key) || 0) + Number(item.quantity));
      }
      const productIds = new Map<string, { product_id: string; variation_id: string | null }>();
      for (const item of oldItems) productIds.set(itemKey(item.product_id, item.variation_id || null), item);
      for (const item of items) productIds.set(itemKey(item.product_id, item.variation_id), item);

      for (const [key, item] of productIds) {
        const quantityDelta = (newQuantities.get(key) || 0) - (oldQuantities.get(key) || 0);
        if (quantityDelta === 0) continue;
        const { error } = await supabase.rpc('adjust_sale_return_stock', {
          _product_id: item.product_id,
          _variation_id: item.variation_id,
          _change_amount: quantityDelta,
          _return_number: saleReturn.return_number,
          _permission: 'edit',
        });
        if (error) throw error;
      }

      const totalAmount = items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
      const { error: headerError } = await supabase
        .from('sale_returns')
        .update({
          refund_method: input.refund_method,
          return_date: input.return_date,
          reason: input.reason,
          notes: input.notes,
          total_amount: totalAmount,
        })
        .eq('id', saleReturn.id);
      if (headerError) throw headerError;

      const { error: deleteItemsError } = await supabase
        .from('sale_return_items')
        .delete()
        .eq('return_id', saleReturn.id);
      if (deleteItemsError) throw deleteItemsError;

      const { error: insertItemsError } = await supabase.from('sale_return_items').insert(items.map(item => ({
        return_id: saleReturn.id,
        product_id: item.product_id,
        variation_id: item.variation_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.quantity * item.unit_price,
      })));
      if (insertItemsError) throw insertItemsError;

      const { error: creditError } = await supabase.rpc('sync_sale_return_debt_credit', {
        _return_id: saleReturn.id,
        _permission: 'edit',
      });
      if (creditError) throw creditError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sale-returns'] });
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['outstanding-sales'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product-variations'] });
      queryClient.invalidateQueries({ queryKey: ['stock-history'] });
      queryClient.invalidateQueries({ queryKey: ['sale-returned-quantities'] });
      queryClient.invalidateQueries({ queryKey: ['debt-payments'] });
      toast({ title: 'Sale return updated successfully' });
    },
    onError: (error: Error) => {
      const { title, description } = parseDbError(error, 'update sale return');
      toast({ title, description, variant: 'destructive' });
    },
  });
}
