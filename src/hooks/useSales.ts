import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { parseDbError } from '@/lib/db-errors';

export type PaymentMethod = 'cash' | 'card' | 'mobile_money' | 'bank_transfer' | 'credit';
export type SaleStatus = 'pending' | 'completed' | 'cancelled' | 'on_hold';

export interface SaleItem {
  id?: string;
  product_id: string;
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
  total_amount: number;
  payment_method: PaymentMethod;
  payment_details?: PaymentDetail[];
  status: SaleStatus;
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
  subtotal: number;
  discount_amount: number;
  discount_percent: number;
  tax_amount: number;
  total_amount: number;
  payment_method: PaymentMethod;
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
  return useQuery({
    queryKey: ['sales'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('sales')
        .select(`
          *,
          sale_items (
            quantity,
            cost_price
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as unknown as (Sale & { sale_items: { quantity: number; cost_price: number }[] })[];
    },
  });
}

export function useSaleWithItems(saleId: string | null) {
  return useQuery({
    queryKey: ['sale', saleId],
    queryFn: async () => {
      if (!saleId) return null;
      
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
    },
    enabled: !!saleId,
  });
}

export function useCreateSale() {
  const queryClient = useQueryClient();
  const { user, organizationId } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: CreateSaleInput) => {
      // Generate sale number
      const { data: saleNumber, error: numberError } = await supabase
        .rpc('generate_sale_number', { org_id: input.organization_id });
      
      if (numberError) throw numberError;

      // Create the sale
      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .insert({
          organization_id: input.organization_id,
          branch_id: input.branch_id || null,
          customer_id: input.customer_id || null,
          sale_number: saleNumber,
          customer_name: input.customer_name || null,
          customer_phone: input.customer_phone || null,
          subtotal: input.subtotal,
          discount_amount: input.discount_amount,
          discount_percent: input.discount_percent,
          tax_amount: input.tax_amount,
          total_amount: input.total_amount,
          payment_method: input.payment_method,
          payment_details: input.payment_details ? JSON.parse(JSON.stringify(input.payment_details)) : null,
          status: input.status || 'completed',
          notes: input.notes || null,
          created_by: user?.id,
        })
        .select()
        .single();

      if (saleError) throw saleError;

      // Create sale items
      const saleItems = input.items.map(item => ({
        sale_id: sale.id,
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        cost_price: item.cost_price,
        discount_amount: item.discount_amount,
        total_price: item.total_price,
      }));

      const { error: itemsError } = await supabase
        .from('sale_items')
        .insert(saleItems);

      if (itemsError) throw itemsError;

      // Update product stock for each item (decrease current_stock for products, not services)
      for (const item of input.items) {
        const { data: product } = await supabase
          .from('products')
          .select('current_stock, item_type')
          .eq('id', item.product_id)
          .single();

        if (product && product.item_type === 'product') {
          const newStock = Number(product.current_stock) - item.quantity;
          
          await supabase
            .from('products')
            .update({ current_stock: newStock })
            .eq('id', item.product_id);

          // Record stock history
          await supabase.from('stock_history').insert({
            product_id: item.product_id,
            previous_stock: product.current_stock,
            new_stock: newStock,
            change_amount: -item.quantity,
            change_type: 'sale',
            notes: `Sale: ${saleNumber}`,
            changed_by: user?.id,
          });
        }
      }

      return sale;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['stock-history'] });
      toast({ title: 'Sale completed successfully' });
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
        customer_name?: string | null;
        customer_phone?: string | null;
        discount_amount?: number;
        discount_percent?: number;
        subtotal?: number;
        total_amount?: number;
        payment_method?: PaymentMethod;
        status?: SaleStatus;
        notes?: string | null;
      };
      items?: SaleItem[];
    }) => {
      // Update sale record
      const { error: saleError } = await supabase
        .from('sales')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', saleId);

      if (saleError) throw saleError;

      // If items are provided, update them
      if (items) {
        // Delete existing items
        const { error: deleteError } = await supabase
          .from('sale_items')
          .delete()
          .eq('sale_id', saleId);

        if (deleteError) throw deleteError;

        // Insert new items
        const saleItems = items.map(item => ({
          sale_id: saleId,
          product_id: item.product_id,
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
