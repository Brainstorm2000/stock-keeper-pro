import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { parseDbError } from '@/lib/db-errors';
import { createId } from '@/lib/utils';
import { getPurchaseItemKey } from '@/lib/purchase-item-key';

export type PurchasePaymentStatus = 'pending' | 'partial' | 'paid';

export interface PurchaseItem {
  id: string;
  purchase_id: string;
  product_id: string;
  variation_id: string | null;
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
  product_variations?: { id: string; sku: string | null } | null;
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
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  payment_status: PurchasePaymentStatus;
  amount_paid: number;
  notes: string | null;
  receipt_url: string | null;
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
  variation_id?: string | null;
  quantity: number;
  unit_cost: number;
  selling_price: number;
}

export interface PurchaseInput {
  branch_id: string;
  supplier_id: string;
  purchase_date?: string;
  reference_number?: string;
  tax_rate?: number;
  payment_status?: PurchasePaymentStatus;
  amount_paid?: number;
  notes?: string;
  receipt_url?: string | null;
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
            variation_id,
            quantity,
            unit_cost,
            total_cost,
            products (id, name, category, units (name, abbreviation)),
            product_variations (id, sku)
          )
        `)
        .order('purchase_date', { ascending: false });

      if (branchId) {
        query = query.eq('branch_id', branchId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as Purchase[];
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
      const taxRate = input.tax_rate || 0;
      const taxAmount = (subtotal * taxRate) / 100;
      const totalAmount = subtotal + taxAmount;

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
          tax_rate: taxRate,
          tax_amount: taxAmount,
          total_amount: totalAmount,
          payment_status: input.payment_status || 'pending',
          amount_paid: input.amount_paid || 0,
          notes: input.notes,
          receipt_url: input.receipt_url ?? null,
          created_by: user?.id,
        })
        .select()
        .single();

      if (purchaseError) throw purchaseError;

      // Create purchase items
      const purchaseItems = input.items.map(item => ({
        purchase_id: purchase.id,
        product_id: item.product_id,
        variation_id: item.variation_id || null,
        quantity: item.quantity,
        unit_cost: item.unit_cost,
        selling_price: item.selling_price || 0,
        total_cost: item.quantity * item.unit_cost,
      }));

      const { error: itemsError } = await supabase
        .from('purchase_items')
        .insert(purchaseItems);

      if (itemsError) throw itemsError;

      // Update product stock levels and create stock history entries
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
          const newStock = previousStock + item.quantity;
          const variationUpdate: Record<string, number> = { current_stock: newStock };
          if (item.unit_cost > 0) variationUpdate.cost_price = item.unit_cost;
          if (item.selling_price > 0) variationUpdate.selling_price = item.selling_price;

          const { error: updateError } = await supabase
            .from('product_variations' as any)
            .update(variationUpdate)
            .eq('id', item.variation_id);
          if (updateError) throw updateError;

          const { error: historyError } = await supabase
            .from('stock_history')
            .insert({
              product_id: item.product_id,
              variation_id: item.variation_id,
              previous_stock: previousStock,
              new_stock: newStock,
              change_amount: item.quantity,
              change_type: 'purchase',
              notes: `Purchase ${purchaseNumber}`,
              changed_by: user?.id,
            } as any);
          if (historyError) throw historyError;
          continue;
        }

        // Get current stock
        const { data: product, error: productError } = await supabase
          .from('products')
          .select('current_stock')
          .eq('id', item.product_id)
          .single();

        if (productError) throw productError;

        const previousStock = Number(product.current_stock);
        const newStock = previousStock + item.quantity;

        // Update product stock and prices
        const updateData: any = { current_stock: newStock };
        if (item.unit_cost > 0) updateData.cost_price = item.unit_cost;
        if (item.selling_price > 0) updateData.selling_price = item.selling_price;

        const { error: updateError } = await supabase
          .from('products')
          .update(updateData)
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

export function useUpdatePurchase() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      purchaseId,
      originalItems,
      input,
    }: {
      purchaseId: string;
      originalItems: PurchaseItem[];
      input: PurchaseInput & { organization_id: string };
    }) => {
      // First, reverse stock for all original items
      for (const item of originalItems) {
        if (item.variation_id) {
          const { data: variation, error: variationError } = await supabase
            .from('product_variations' as any)
            .select('current_stock')
            .eq('id', item.variation_id)
            .eq('product_id', item.product_id)
            .single();
          if (variationError) throw variationError;

          const previousStock = Number((variation as any).current_stock);
          const newStock = Math.max(0, previousStock - Number(item.quantity));
          const { error: updateError } = await supabase
            .from('product_variations' as any)
            .update({ current_stock: newStock })
            .eq('id', item.variation_id);
          if (updateError) throw updateError;

          const { error: historyError } = await supabase
            .from('stock_history')
            .insert({
              product_id: item.product_id,
              variation_id: item.variation_id,
              previous_stock: previousStock,
              new_stock: newStock,
              change_amount: -Number(item.quantity),
              change_type: 'purchase_reversal',
              notes: 'Edit purchase - reversal',
              changed_by: user?.id,
            } as any);
          if (historyError) throw historyError;
          continue;
        }

        const { data: product, error: productError } = await supabase
          .from('products')
          .select('current_stock')
          .eq('id', item.product_id)
          .single();

        if (productError) throw productError;

        const previousStock = Number(product.current_stock);
        const newStock = Math.max(0, previousStock - item.quantity);

        const { error: updateError } = await supabase
          .from('products')
          .update({ current_stock: newStock })
          .eq('id', item.product_id);

        if (updateError) throw updateError;

        const { error: historyError } = await supabase
          .from('stock_history')
          .insert({
            product_id: item.product_id,
            previous_stock: previousStock,
            new_stock: newStock,
            change_amount: -item.quantity,
            change_type: 'purchase_reversal',
            notes: `Edit purchase - reversal`,
            changed_by: user?.id,
          });

        if (historyError) throw historyError;
      }

      // Calculate new totals
      const subtotal = input.items.reduce((sum, item) => sum + (item.quantity * item.unit_cost), 0);
      const taxRate = input.tax_rate || 0;
      const taxAmount = (subtotal * taxRate) / 100;
      const totalAmount = subtotal + taxAmount;

      // Update purchase record
      const { data: purchase, error: purchaseError } = await supabase
        .from('purchases')
        .update({
          branch_id: input.branch_id,
          supplier_id: input.supplier_id,
          purchase_date: input.purchase_date || new Date().toISOString().split('T')[0],
          reference_number: input.reference_number,
          subtotal,
          tax_rate: taxRate,
          tax_amount: taxAmount,
          total_amount: totalAmount,
          payment_status: input.payment_status || 'pending',
          amount_paid: input.amount_paid || 0,
          notes: input.notes,
          receipt_url: input.receipt_url ?? null,
        })
        .eq('id', purchaseId)
        .select()
        .single();

      if (purchaseError) throw purchaseError;

      // Delete old purchase items
      const { error: deleteItemsError } = await supabase
        .from('purchase_items')
        .delete()
        .eq('purchase_id', purchaseId);

      if (deleteItemsError) throw deleteItemsError;

      // Create new purchase items
      const purchaseItems = input.items.map(item => ({
        purchase_id: purchaseId,
        product_id: item.product_id,
        variation_id: item.variation_id || null,
        quantity: item.quantity,
        unit_cost: item.unit_cost,
        selling_price: item.selling_price || 0,
        total_cost: item.quantity * item.unit_cost,
      }));

      const { error: itemsError } = await supabase
        .from('purchase_items')
        .insert(purchaseItems);

      if (itemsError) throw itemsError;

      // Add new stock for new items
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
          const newStock = previousStock + item.quantity;
          const variationUpdate: Record<string, number> = { current_stock: newStock };
          if (item.unit_cost > 0) variationUpdate.cost_price = item.unit_cost;
          if (item.selling_price > 0) variationUpdate.selling_price = item.selling_price;
          const { error: updateError } = await supabase
            .from('product_variations' as any)
            .update(variationUpdate)
            .eq('id', item.variation_id);
          if (updateError) throw updateError;

          const { error: historyError } = await supabase
            .from('stock_history')
            .insert({
              product_id: item.product_id,
              variation_id: item.variation_id,
              previous_stock: previousStock,
              new_stock: newStock,
              change_amount: item.quantity,
              change_type: 'purchase',
              notes: `Edit purchase ${purchase.purchase_number}`,
              changed_by: user?.id,
            } as any);
          if (historyError) throw historyError;
          continue;
        }

        const { data: product, error: productError } = await supabase
          .from('products')
          .select('current_stock')
          .eq('id', item.product_id)
          .single();

        if (productError) throw productError;

        const previousStock = Number(product.current_stock);
        const newStock = previousStock + item.quantity;

        const updateData: any = { current_stock: newStock };
        if (item.unit_cost > 0) updateData.cost_price = item.unit_cost;
        if (item.selling_price > 0) updateData.selling_price = item.selling_price;

        const { error: updateError } = await supabase
          .from('products')
          .update(updateData)
          .eq('id', item.product_id);

        if (updateError) throw updateError;

        const { error: historyError } = await supabase
          .from('stock_history')
          .insert({
            product_id: item.product_id,
            previous_stock: previousStock,
            new_stock: newStock,
            change_amount: item.quantity,
            change_type: 'purchase',
            notes: `Edit purchase ${purchase.purchase_number}`,
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
      toast({ title: 'Purchase updated successfully' });
    },
    onError: (error: Error) => {
      const { title, description } = parseDbError(error, 'update purchase');
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
      const { data: purchaseReturns, error: returnsQueryError } = await supabase
        .from('purchase_returns')
        .select('id, purchase_return_items(product_id, variation_id, quantity)')
        .eq('purchase_id', purchase.id);

      if (returnsQueryError) throw returnsQueryError;

      const returnedQuantities = new Map<string, number>();
      for (const purchaseReturn of (purchaseReturns || []) as unknown as Array<{
        id: string;
        purchase_return_items?: Array<{ product_id: string; variation_id: string | null; quantity: number }>;
      }>) {
        for (const item of purchaseReturn.purchase_return_items || []) {
          const key = getPurchaseItemKey(item.product_id, item.variation_id);
          returnedQuantities.set(
            key,
            (returnedQuantities.get(key) || 0) + Number(item.quantity),
          );
        }
      }

      // First, reverse the stock changes
      if (purchase.purchase_items) {
        for (const item of purchase.purchase_items) {
          const returnedKey = getPurchaseItemKey(item.product_id, item.variation_id);
          const netQuantity = Math.max(
            0,
            Number(item.quantity) - (returnedQuantities.get(returnedKey) || 0),
          );

          if (item.variation_id) {
            const { data: variation, error: variationError } = await supabase
              .from('product_variations' as any)
              .select('current_stock')
              .eq('id', item.variation_id)
              .eq('product_id', item.product_id)
              .single();
            if (variationError) throw variationError;
            const previousStock = Number((variation as any).current_stock);
            const newStock = Math.max(0, previousStock - netQuantity);
            const { error: updateError } = await supabase
              .from('product_variations' as any)
              .update({ current_stock: newStock })
              .eq('id', item.variation_id);
            if (updateError) throw updateError;
            const { error: historyError } = await supabase
              .from('stock_history')
              .insert({
                product_id: item.product_id,
                variation_id: item.variation_id,
                previous_stock: previousStock,
                new_stock: newStock,
                change_amount: -netQuantity,
                change_type: 'purchase_reversal',
                notes: `Deleted purchase ${purchase.purchase_number}`,
                changed_by: user?.id,
              } as any);
            if (historyError) throw historyError;
            continue;
          }

          // Get current stock
          const { data: product, error: productError } = await supabase
            .from('products')
            .select('current_stock')
            .eq('id', item.product_id)
            .single();

          if (productError) throw productError;

          const previousStock = Number(product.current_stock);
          const newStock = previousStock - netQuantity;

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
              change_amount: -netQuantity,
              change_type: 'purchase_reversal',
              notes: `Deleted purchase ${purchase.purchase_number}`,
              changed_by: user?.id,
            });

          if (historyError) throw historyError;
        }
      }

      // Remove returns explicitly because purchase_returns references purchases without cascade.
      for (const purchaseReturn of purchaseReturns || []) {
        const { error: returnItemsError } = await supabase
          .from('purchase_return_items')
          .delete()
          .eq('return_id', purchaseReturn.id);
        if (returnItemsError) throw returnItemsError;

        const { error: returnError } = await supabase
          .from('purchase_returns')
          .delete()
          .eq('id', purchaseReturn.id);
        if (returnError) throw returnError;
      }

      const { error: purchaseItemsError } = await supabase
        .from('purchase_items')
        .delete()
        .eq('purchase_id', purchase.id);
      if (purchaseItemsError) throw purchaseItemsError;

      const { data: deletedPurchase, error } = await supabase
        .from('purchases')
        .delete()
        .eq('id', purchase.id)
        .select('id');

      if (error) throw error;
      if (!deletedPurchase || deletedPurchase.length === 0) {
        throw new Error('Purchase was not deleted. You may not have permission to delete it.');
      }
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

export async function uploadPurchaseReceipt(file: File, organizationId: string): Promise<string> {
  const fileExt = file.name.split('.').pop();
  const fileName = `${organizationId}/${createId()}.${fileExt}`;
  const { error } = await supabase.storage.from('purchase-receipts').upload(fileName, file);
  if (error) throw error;
  return fileName;
}

export async function getPurchaseReceiptUrl(receiptRef: string): Promise<string> {
  if (/^https?:\/\//i.test(receiptRef)) return receiptRef;
  const { data, error } = await supabase.storage
    .from('purchase-receipts')
    .createSignedUrl(receiptRef, 60 * 10);
  if (error || !data?.signedUrl) throw error ?? new Error('Could not generate receipt URL');
  return data.signedUrl;
}
