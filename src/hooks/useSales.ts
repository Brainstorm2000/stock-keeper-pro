import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { parseDbError } from '@/lib/db-errors';
import { buildSaleStockAdjustments } from '@/lib/sale-stock';
import { localDb } from '@/lib/offline/db';
import { readLocalFirst, saveLocal } from '@/lib/offline/repository';
import { syncQueue } from '@/lib/offline/sync';

export type PaymentMethod = 'cash' | 'card' | 'mobile_money' | 'bank_transfer' | 'credit' | 'pos';
export type SaleStatus = 'pending' | 'completed' | 'cancelled' | 'on_hold';

export interface SaleItem {
  id?: string;
  product_id: string;
  variation_id?: string | null;
  product_name?: string;
  quantity: number;
  unit_price: number;
  cost_price: number;
  discount_amount: number;
  total_price: number;
}

export interface PaymentDetail {
  method: PaymentMethod;
  amount: number;
  method_id?: string;
  method_name?: string;
}

export interface Sale {
  id: string;
  organization_id: string;
  branch_id: string | null;
  customer_id: string | null;
  sale_number: string;
  customer_name: string | null;
  customer_phone: string | null;
  subtotal: number;
  discount_amount: number;
  discount_percent: number;
  tax_amount: number;
  wht_amount: number;
  total_amount: number;
  payment_method: PaymentMethod;
  payment_method_id?: string | null;
  payment_details?: PaymentDetail[];
  status: SaleStatus;
  payment_status?: 'paid' | 'partial' | 'outstanding';
  amount_paid?: number;
  balance_due?: number;
  due_date?: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  sale_items?: SaleItem[];
}

export interface CreateSaleInput {
  organization_id: string;
  branch_id?: string;
  customer_id?: string;
  customer_name?: string;
  customer_phone?: string;
  sale_date?: string;
  subtotal: number;
  discount_amount: number;
  discount_percent: number;
  tax_amount: number;
  wht_amount?: number;
  total_amount: number;
  amount_paid?: number;
  balance_due?: number;
  payment_status?: string;
  due_date?: string;
  payment_method: PaymentMethod;
  payment_method_id?: string | null;
  payment_details?: PaymentDetail[];
  status?: SaleStatus;
  notes?: string;
  items: SaleItem[];
}

export interface HeldOrder {
  id: string;
  organization_id: string;
  branch_id: string | null;
  customer_name: string | null;
  items: SaleItem[];
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export function useSales() {
  const { organizationId } = useAuth();
  return useQuery({
    queryKey: ['sales', organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      return readLocalFirst(localDb.sales, async () => {
        const { data, error } = await supabase
          .from('sales')
          .select(`
          *,
          sale_items (
            product_id,
            variation_id,
            quantity,
            unit_price,
            cost_price,
            total_price
          )
          `)
          .eq('organization_id', organizationId!)
          .order('created_at', { ascending: false });

        if (error) throw error;
        return data as unknown as (Sale & {
          sale_items: {
            product_id: string;
            variation_id?: string | null;
            quantity: number;
            unit_price: number;
            cost_price: number;
            total_price: number;
          }[];
        })[];
      }, (sale) => sale.organization_id === organizationId);
    },
  });
}

export function useSaleWithItems(saleId: string | null) {
  const { organizationId } = useAuth();
  return useQuery({
    queryKey: ['sale', organizationId, saleId],
    queryFn: async () => {
      if (!saleId) return null;

      const readLocalSale = async () => {
        const localSale = await localDb.sales.get(saleId);
        if (!localSale || localSale.deletedAt || localSale.data.organization_id !== organizationId) {
          return null;
        }
        const localItems = (await localDb.saleItems.toArray())
          .filter((row) => !row.deletedAt && row.data.sale_id === saleId)
          .map((row) => row.data);
        const localProducts = await localDb.products.toArray();
        const productNames = new Map(localProducts.map((row) => [row.id, row.data.name]));
        const items = localItems.length ? localItems : (localSale.data.sale_items ?? []).map((item) => ({
          ...item,
          sale_id: saleId,
        }));
        return {
          ...localSale.data,
          payment_details: localSale.data.payment_details,
          sale_items: items.map((item) => ({
            ...item,
            product_name: item.product_name || productNames.get(item.product_id),
          })),
        } as Sale;
      };

        const localSaleRecord = await localDb.sales.get(saleId);
        if (localSaleRecord && !localSaleRecord.isSynced && !localSaleRecord.deletedAt) {
          return readLocalSale();
        }

        if (typeof navigator !== 'undefined' && navigator.onLine === false) return readLocalSale();
      try {
        const { data: sale, error: saleError } = await supabase
          .from('sales')
          .select('*')
          .eq('id', saleId)
          .single();

        if (saleError) throw saleError;

        const { data: items, error: itemsError } = await supabase
          .from('sale_items')
          .select(`
            *,
            products (name)
          `)
          .eq('sale_id', saleId);

        if (itemsError) throw itemsError;

        return {
          ...sale,
          payment_details: (sale.payment_details as unknown) as PaymentDetail[] | undefined,
          sale_items: items.map((item: any) => ({
            ...item,
            product_name: item.products?.name,
          })),
        } as Sale;
      } catch (error) {
        const localSale = await readLocalSale();
        if (localSale) return localSale;
        throw error;
      }
    },
    enabled: !!saleId && !!organizationId,
  });
}

export function useCreateSale() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: CreateSaleInput) => {
      {
        const now = new Date().toISOString();
        const sale: Sale = {
          id: crypto.randomUUID(),
          organization_id: input.organization_id,
          branch_id: input.branch_id ?? null,
          customer_id: input.customer_id ?? null,
          sale_number: `POS-${Date.now()}`,
          customer_name: input.customer_name ?? null,
          customer_phone: input.customer_phone ?? null,
          subtotal: input.subtotal,
          discount_amount: input.discount_amount,
          discount_percent: input.discount_percent,
          tax_amount: input.tax_amount,
          wht_amount: input.wht_amount ?? 0,
          total_amount: input.total_amount,
          payment_method: input.payment_method,
          payment_method_id: input.payment_method_id ?? null,
          payment_details: input.payment_details,
          status: input.status ?? 'completed',
          payment_status: (input.payment_status ?? 'paid') as Sale['payment_status'],
          amount_paid: input.amount_paid ?? input.total_amount,
          balance_due: input.balance_due ?? 0,
          due_date: input.due_date ?? null,
          notes: input.notes ?? null,
          created_by: user?.id ?? null,
          created_at: now,
          updated_at: now,
          sale_items: input.items,
        };
        await saveLocal(localDb.sales, sale);
        await localDb.saleItems.bulkPut(input.items.map((item) => ({
          id: item.id ?? crypto.randomUUID(),
          data: { ...item, sale_id: sale.id },
          isSynced: false,
          updatedAt: now,
        })));
        for (const item of input.items) {
          if (item.variation_id) continue;
          const product = await localDb.products.get(item.product_id);
          if (product?.data.item_type === 'product') {
            const previousStock = Number(product.data.current_stock);
            const newStock = previousStock - item.quantity;
            await saveLocal(localDb.products, {
              ...product.data,
              current_stock: newStock,
            });
            await localDb.stockHistory.put({
              id: crypto.randomUUID(),
              data: {
                product_id: item.product_id,
                previous_stock: previousStock,
                new_stock: newStock,
                change_amount: -item.quantity,
                change_type: 'sale',
                notes: `Sale: ${sale.sale_number}`,
                changed_by: user?.id ?? null,
                created_at: now,
              },
              isSynced: false,
              updatedAt: now,
            });
          }
        }
        void syncQueue();
        return sale;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['stock-history'] });
      toast({ title: 'Sale saved', description: 'Print customer receipt' });
    },
    onError: (error: Error) => {
      const { title, description } = parseDbError(error, 'complete sale');
      toast({ title, description, variant: 'destructive' });
    },
  });
}

export function useUpdateSale() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      saleId,
      updates,
      items,
    }: {
      saleId: string;
      updates: {
        branch_id?: string | null;
        customer_id?: string | null;
        customer_name?: string | null;
        customer_phone?: string | null;
        discount_amount?: number;
        discount_percent?: number;
        subtotal?: number;
        tax_amount?: number;
        wht_amount?: number;
        total_amount?: number;
        amount_paid?: number;
        balance_due?: number;
        payment_status?: 'paid' | 'partial' | 'outstanding';
        due_date?: string | null;
        payment_method?: PaymentMethod;
        status?: SaleStatus;
        notes?: string | null;
        sale_date?: string;
      };
      items?: SaleItem[];
    }) => {
      const { data: existingSale, error: saleLookupError } = await supabase
        .from('sales')
        .select('created_at')
        .eq('id', saleId)
        .single();

      if (saleLookupError) throw saleLookupError;

      const { data: previousItems, error: previousItemsError } = await supabase
        .from('sale_items')
        .select('product_id, variation_id, quantity')
        .eq('sale_id', saleId);

      if (previousItemsError) throw previousItemsError;

      const previousItemsList = (previousItems || []).map(item => ({
        product_id: item.product_id,
        variation_id: (item as any).variation_id || null,
        quantity: Number(item.quantity),
      }));

      const nextItemsList = (items || previousItemsList).map(item => ({
        product_id: item.product_id,
        variation_id: (item as any).variation_id || null,
        quantity: Number(item.quantity),
      }));

      const { sale_date: saleDate, ...saleUpdates } = updates;

      const { error: saleError } = await supabase
        .from('sales')
        .update({
          ...saleUpdates,
          updated_at: new Date().toISOString(),
          ...(saleDate ? (() => {
            const now = new Date(existingSale?.created_at || new Date().toISOString());
            const [y, m, d] = saleDate!.split('-').map(Number);
            const dt = new Date(
              y,
              (m || 1) - 1,
              d || 1,
              now.getHours(),
              now.getMinutes(),
              now.getSeconds(),
              now.getMilliseconds(),
            );
            return { created_at: dt.toISOString() };
          })() : {}),
        })
        .eq('id', saleId);

      if (saleError) throw saleError;

      if (items) {
        const { error: deleteError } = await supabase
          .from('sale_items')
          .delete()
          .eq('sale_id', saleId);

        if (deleteError) throw deleteError;

        const saleItems = items.map(item => ({
          sale_id: saleId,
          product_id: item.product_id,
          variation_id: item.variation_id || null,
          quantity: item.quantity,
          unit_price: item.unit_price,
          cost_price: item.cost_price,
          discount_amount: item.discount_amount,
          total_price: item.total_price,
        }));

        const { error: insertError } = await supabase
          .from('sale_items')
          .insert(saleItems);

        if (insertError) throw insertError;
      }

      const adjustments = buildSaleStockAdjustments(previousItemsList, nextItemsList);
      for (const adjustment of adjustments) {
        if (adjustment.variation_id) {
          const { data: variation } = await supabase
            .from('product_variations' as any)
            .select('current_stock')
            .eq('id', adjustment.variation_id)
            .single();

          if (variation) {
            const prev = Number((variation as any).current_stock);
            const next = prev - adjustment.quantity;
            await supabase
              .from('product_variations' as any)
              .update({ current_stock: next })
              .eq('id', adjustment.variation_id);
            await supabase.from('stock_history').insert({
              product_id: adjustment.product_id,
              variation_id: adjustment.variation_id,
              previous_stock: prev,
              new_stock: next,
              change_amount: -adjustment.quantity,
              change_type: 'sale',
              notes: `Sale edited`,
            } as any);
          }
          continue;
        }

        const { data: product } = await supabase
          .from('products')
          .select('current_stock, item_type')
          .eq('id', adjustment.product_id)
          .single();

        if (product && product.item_type === 'product') {
          const prev = Number(product.current_stock);
          const next = prev - adjustment.quantity;

          await supabase
            .from('products')
            .update({ current_stock: next })
            .eq('id', adjustment.product_id);

          await supabase.from('stock_history').insert({
            product_id: adjustment.product_id,
            previous_stock: prev,
            new_stock: next,
            change_amount: -adjustment.quantity,
            change_type: 'sale',
            notes: `Sale edited`,
          });
        }
      }

      return { saleId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['sale'] });
      toast({ title: 'Sale updated successfully' });
    },
    onError: (error: Error) => {
      const { title, description } = parseDbError(error, 'update sale');
      toast({ title, description, variant: 'destructive' });
    },
  });
}

export function useHeldOrders() {
  return useQuery({
    queryKey: ['held-orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('held_orders')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []).map((order: any) => ({
        ...order,
        items: order.items as SaleItem[],
      })) as HeldOrder[];
    },
  });
}

export function useCreateHeldOrder() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: {
      organization_id: string;
      branch_id?: string;
      customer_name?: string;
      items: SaleItem[];
      notes?: string;
    }) => {
      const { data, error } = await supabase
        .from('held_orders')
        .insert({
          organization_id: input.organization_id,
          branch_id: input.branch_id || null,
          customer_name: input.customer_name || null,
          items: JSON.parse(JSON.stringify(input.items)),
          notes: input.notes || null,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['held-orders'] });
      toast({ title: 'Order held successfully' });
    },
    onError: (error: Error) => {
      const { title, description } = parseDbError(error, 'hold order');
      toast({ title, description, variant: 'destructive' });
    },
  });
}

export function useDeleteHeldOrder() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('held_orders')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['held-orders'] });
    },
    onError: (error: Error) => {
      const { title, description } = parseDbError(error, 'delete held order');
      toast({ title, description, variant: 'destructive' });
    },
  });
}

export function useDeleteSale() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (saleId: string) => {
      // Get the sale with items first
      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .select('*, sale_number')
        .eq('id', saleId)
        .single();

      if (saleError) throw saleError;

      const { data: saleItems, error: itemsError } = await supabase
        .from('sale_items')
        .select('*')
        .eq('sale_id', saleId);

      if (itemsError) throw itemsError;

      // Restore stock for each item (only for 'product' type items)
      for (const item of saleItems || []) {
        if ((item as any).variation_id) {
          const { data: variation } = await supabase
            .from('product_variations' as any)
            .select('current_stock')
            .eq('id', (item as any).variation_id)
            .single();
          if (variation) {
            const prev = Number((variation as any).current_stock);
            const next = prev + Number(item.quantity);
            await supabase
              .from('product_variations' as any)
              .update({ current_stock: next })
              .eq('id', (item as any).variation_id);
            await supabase.from('stock_history').insert({
              product_id: item.product_id,
              variation_id: (item as any).variation_id,
              previous_stock: prev,
              new_stock: next,
              change_amount: Number(item.quantity),
              change_type: 'increase',
              notes: `Sale deleted: ${sale.sale_number}`,
              changed_by: user?.id,
            } as any);
          }
          continue;
        }
        const { data: product } = await supabase
          .from('products')
          .select('current_stock, item_type')
          .eq('id', item.product_id)
          .single();

        if (product && product.item_type === 'product') {
          const restoredStock = Number(product.current_stock) + Number(item.quantity);
          
          await supabase
            .from('products')
            .update({ current_stock: restoredStock })
            .eq('id', item.product_id);

          // Record stock history for restoration
          await supabase.from('stock_history').insert({
            product_id: item.product_id,
            previous_stock: product.current_stock,
            new_stock: restoredStock,
            change_amount: Number(item.quantity),
            change_type: 'increase',
            notes: `Sale deleted: ${sale.sale_number}`,
            changed_by: user?.id,
          });
        }
      }

      // Delete sale items first
      const { error: deleteItemsError } = await supabase
        .from('sale_items')
        .delete()
        .eq('sale_id', saleId);

      if (deleteItemsError) throw deleteItemsError;

      // Delete the sale
      const { error: deleteSaleError } = await supabase
        .from('sales')
        .delete()
        .eq('id', saleId);

      if (deleteSaleError) throw deleteSaleError;

      return { saleNumber: sale.sale_number };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['stock-history'] });
      toast({ title: `Sale ${data.saleNumber} deleted`, description: 'Stock has been restored.' });
    },
    onError: (error: Error) => {
      const { title, description } = parseDbError(error, 'delete sale');
      toast({ title, description, variant: 'destructive' });
    },
  });
}
