import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { parseDbError } from '@/lib/db-errors';
import { getPurchaseItemKey } from '@/lib/purchase-item-key';

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
  variation_id: string | null;
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
        .select(`*, purchases(id, purchase_number), branches(id, name), purchase_return_items(*, products(id, name, units(name, abbreviation)), product_variations(id, sku))`)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as PurchaseReturn[];
    },
  });
}

export function useAlreadyReturnedPurchaseQuantities(purchaseId: string | undefined) {
  return useQuery({
    queryKey: ['purchase-returned-quantities', purchaseId],
    enabled: !!purchaseId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('purchase_return_items')
        .select('product_id, variation_id, quantity, purchase_returns!inner(purchase_id)')
        .eq('purchase_returns.purchase_id', purchaseId!);
      if (error) throw error;
      const map: Record<string, number> = {};
      for (const item of (data || [])) {
        const key = getPurchaseItemKey(item.product_id, item.variation_id);
        map[key] = (map[key] || 0) + Number(item.quantity);
      }
      return map;
    },
  });
}

export function useUndoPurchaseReturn() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (ret: PurchaseReturn) => {
      // Reverse stock: re-add items that were deducted
      for (const item of (ret.purchase_return_items || [])) {
        if (item.variation_id) {
          const { data: variation, error: variationError } = await supabase
            .from('product_variations' as any)
            .select('current_stock')
            .eq('id', item.variation_id)
            .eq('product_id', item.product_id)
            .single();
          if (variationError) throw variationError;
          const previousStock = Number((variation as any).current_stock);
          const newStock = previousStock + Number(item.quantity);
          const { error: updateError } = await supabase
            .from('product_variations' as any)
            .update({ current_stock: newStock })
            .eq('id', item.variation_id);
          if (updateError) throw updateError;
          const { error: historyError } = await supabase.from('stock_history').insert({
            product_id: item.product_id,
            variation_id: item.variation_id,
            previous_stock: previousStock,
            new_stock: newStock,
            change_amount: Number(item.quantity),
            change_type: 'purchase_return',
            notes: `Undo purchase return ${ret.return_number}`,
            changed_by: user?.id,
          } as any);
          if (historyError) throw historyError;
          continue;
        }

        const { data: product } = await supabase
          .from('products')
          .select('current_stock')
          .eq('id', item.product_id)
          .single();

        if (product) {
          const prev = Number(product.current_stock);
          const newStock = prev + item.quantity;
          await supabase.from('products').update({ current_stock: newStock }).eq('id', item.product_id);
          await supabase.from('stock_history').insert({
            product_id: item.product_id,
            previous_stock: prev,
            new_stock: newStock,
            change_amount: item.quantity,
            change_type: 'purchase_return',
            notes: `Undo purchase return ${ret.return_number}`,
            changed_by: user?.id,
          });
        }
      }
      // Reverse balance adjustment on purchases
      const { data: purchase } = await supabase
        .from('purchases')
        .select('total_amount, amount_paid, payment_status')
        .eq('id', ret.purchase_id)
        .single();

      if (purchase && (purchase.payment_status === 'partial' || purchase.payment_status === 'pending' || purchase.payment_status === 'paid')) {
        const newTotal = Number(purchase.total_amount) + ret.total_amount;
        const newBalance = newTotal - Number(purchase.amount_paid);
        const newStatus = newBalance <= 0 ? 'paid' : Number(purchase.amount_paid) > 0 ? 'partial' : 'pending';
        await supabase.from('purchases').update({
          total_amount: newTotal,
          payment_status: newStatus,
        }).eq('id', ret.purchase_id);
      }

      await supabase.from('purchase_return_items').delete().eq('return_id', ret.id);
      const { error } = await supabase.from('purchase_returns').delete().eq('id', ret.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-returns'] });
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['stock-history'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-returned-quantities'] });
      toast({ title: 'Purchase return undone successfully' });
    },
    onError: (error: Error) => {
      const { title, description } = parseDbError(error, 'undo purchase return');
      toast({ title, description, variant: 'destructive' });
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
      items: { product_id: string; variation_id?: string | null; quantity: number; unit_cost: number }[];
    }) => {
      const { data: returnNumber, error: numErr } = await supabase
        .rpc('generate_purchase_return_number', { org_id: input.organization_id });
      if (numErr) throw numErr;

      const totalAmount = input.items.reduce((s, i) => s + i.quantity * i.unit_cost, 0);

      const { data: purchaseItems, error: purchaseItemsError } = await supabase
        .from('purchase_items')
        .select('product_id, variation_id, quantity')
        .eq('purchase_id', input.purchase_id);

      if (purchaseItemsError) throw purchaseItemsError;

      const { data: returnedItems, error: returnedItemsError } = await supabase
        .from('purchase_return_items')
        .select('product_id, variation_id, quantity, purchase_returns!inner(purchase_id)')
        .eq('purchase_returns.purchase_id', input.purchase_id);

      if (returnedItemsError) throw returnedItemsError;

      const purchasedQuantities = new Map<string, number>();
      for (const item of purchaseItems || []) {
        const key = getPurchaseItemKey(item.product_id, item.variation_id);
        purchasedQuantities.set(key, (purchasedQuantities.get(key) || 0) + Number(item.quantity));
      }

      const alreadyReturnedQuantities = new Map<string, number>();
      for (const item of returnedItems || []) {
        const key = getPurchaseItemKey(item.product_id, item.variation_id);
        alreadyReturnedQuantities.set(key, (alreadyReturnedQuantities.get(key) || 0) + Number(item.quantity));
      }

      for (const item of input.items) {
        const key = getPurchaseItemKey(item.product_id, item.variation_id);
        const purchasedQuantity = purchasedQuantities.get(key);
        if (purchasedQuantity === undefined) {
          throw new Error('Selected item was not found on the purchase.');
        }

        const alreadyReturnedQuantity = alreadyReturnedQuantities.get(key) || 0;
        const remainingAllowed = Math.max(0, purchasedQuantity - alreadyReturnedQuantity);
        if (item.quantity > remainingAllowed) {
          throw new Error('Return quantity cannot exceed the quantity purchased and not already returned.');
        }

        if (item.variation_id) {
          const { data: variation, error: variationError } = await supabase
            .from('product_variations' as any)
            .select('current_stock')
            .eq('id', item.variation_id)
            .eq('product_id', item.product_id)
            .single();
          if (variationError) throw variationError;
          if (!variation || Number((variation as any).current_stock) < item.quantity) {
            throw new Error('Return quantity cannot exceed the current variation stock available.');
          }
          continue;
        }

        const { data: product, error: productError } = await supabase
          .from('products')
          .select('current_stock')
          .eq('id', item.product_id)
          .single();

        if (productError) throw productError;
        if (!product || Number(product.current_stock) < item.quantity) {
          throw new Error('Return quantity cannot exceed the current stock available.');
        }
      }

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
        variation_id: i.variation_id || null,
        quantity: i.quantity,
        unit_cost: i.unit_cost,
        total_cost: i.quantity * i.unit_cost,
      }));

      const { error: itemsErr } = await supabase.from('purchase_return_items').insert(items);
      if (itemsErr) throw itemsErr;

      // Reverse stock for returned items
      for (const item of input.items) {
        if (item.variation_id) {
          const { data: variation, error: variationError } = await supabase
            .from('product_variations' as any)
            .select('current_stock')
            .eq('id', item.variation_id)
            .eq('product_id', item.product_id)
            .single();
          if (variationError) throw variationError;
          const previousStock = Number((variation as any).current_stock);
          const newStock = Math.max(0, previousStock - item.quantity);
          const { error: updateError } = await supabase
            .from('product_variations' as any)
            .update({ current_stock: newStock })
            .eq('id', item.variation_id);
          if (updateError) throw updateError;
          const { error: historyError } = await supabase.from('stock_history').insert({
            product_id: item.product_id,
            variation_id: item.variation_id,
            previous_stock: previousStock,
            new_stock: newStock,
            change_amount: -item.quantity,
            change_type: 'purchase_return',
            notes: `Purchase return ${returnNumber}`,
            changed_by: user?.id,
          } as any);
          if (historyError) throw historyError;
          continue;
        }

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

      // Adjust purchase balance: reduce total_amount by return amount
      const { data: purchase } = await supabase
        .from('purchases')
        .select('total_amount, amount_paid, payment_status')
        .eq('id', input.purchase_id)
        .single();

      if (purchase && (purchase.payment_status === 'partial' || purchase.payment_status === 'pending')) {
        const newTotal = Math.max(0, Number(purchase.total_amount) - totalAmount);
        const newBalance = newTotal - Number(purchase.amount_paid);
        const newStatus = newBalance <= 0 ? 'paid' : Number(purchase.amount_paid) > 0 ? 'partial' : 'pending';
        await supabase.from('purchases').update({
          total_amount: newTotal,
          payment_status: newStatus,
        }).eq('id', input.purchase_id);
      }

      return ret;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase-returns'] });
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['stock-history'] });
      queryClient.invalidateQueries({ queryKey: ['purchase-returned-quantities'] });
      toast({ title: 'Purchase return recorded' });
    },
    onError: (error: Error) => {
      const { title, description } = parseDbError(error, 'create purchase return');
      toast({ title, description, variant: 'destructive' });
    },
  });
}
