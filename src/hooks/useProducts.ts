import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';

export interface Product {
  id: string;
  name: string;
  unit_id: string;
  branch_id: string | null;
  opening_stock: number;
  current_stock: number;
  low_stock_threshold: number;
  out_of_stock_threshold: number;
  sku: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
  units?: {
    id: string;
    name: string;
    abbreviation: string | null;
  };
  branches?: {
    id: string;
    name: string;
  };
}

export interface ProductInput {
  name: string;
  unit_id: string;
  branch_id?: string;
  opening_stock: number;
  current_stock: number;
  low_stock_threshold: number;
  out_of_stock_threshold: number;
  sku?: string;
  description?: string;
}

export interface DuplicateCheckResult {
  isDuplicate: boolean;
  reason?: 'name_branch' | 'sku';
  existingProduct?: Product;
}

// Check if a product with the same name+branch or SKU exists
export async function checkProductDuplicate(
  name: string,
  branchId: string | null | undefined,
  sku: string | null | undefined,
  excludeProductId?: string
): Promise<DuplicateCheckResult> {
  // Check for name + branch duplicate
  let query = supabase
    .from('products')
    .select('id, name, sku, branch_id')
    .ilike('name', name.trim());

  if (branchId) {
    query = query.eq('branch_id', branchId);
  } else {
    query = query.is('branch_id', null);
  }

  if (excludeProductId) {
    query = query.neq('id', excludeProductId);
  }

  const { data: nameMatches, error: nameError } = await query;
  
  if (nameError) throw nameError;

  if (nameMatches && nameMatches.length > 0) {
    return { 
      isDuplicate: true, 
      reason: 'name_branch',
      existingProduct: nameMatches[0] as unknown as Product
    };
  }

  // Check for SKU duplicate if SKU is provided
  if (sku && sku.trim()) {
    let skuQuery = supabase
      .from('products')
      .select('id, name, sku, branch_id')
      .ilike('sku', sku.trim());

    if (excludeProductId) {
      skuQuery = skuQuery.neq('id', excludeProductId);
    }

    const { data: skuMatches, error: skuError } = await skuQuery;

    if (skuError) throw skuError;

    if (skuMatches && skuMatches.length > 0) {
      return { 
        isDuplicate: true, 
        reason: 'sku',
        existingProduct: skuMatches[0] as unknown as Product
      };
    }
  }

  return { isDuplicate: false };
}

export function useProducts() {
  return useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          units (id, name, abbreviation),
          branches (id, name)
        `)
        .order('name');

      if (error) throw error;
      return data as Product[];
    },
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (product: ProductInput) => {
      const { data, error } = await supabase
        .from('products')
        .insert({
          ...product,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Create initial stock history entry
      await supabase.from('stock_history').insert({
        product_id: data.id,
        previous_stock: 0,
        new_stock: product.current_stock,
        change_amount: product.current_stock,
        change_type: 'initial',
        notes: 'Initial stock entry',
        changed_by: user?.id,
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({ title: 'Product created successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create product', description: error.message, variant: 'destructive' });
    },
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...product }: ProductInput & { id: string }) => {
      const { data, error } = await supabase
        .from('products')
        .update(product)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({ title: 'Product updated successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update product', description: error.message, variant: 'destructive' });
    },
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('products').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({ title: 'Product deleted successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to delete product', description: error.message, variant: 'destructive' });
    },
  });
}

export function useUpdateStock() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      productId,
      currentStock,
      newStock,
      changeType,
      notes,
    }: {
      productId: string;
      currentStock: number;
      newStock: number;
      changeType: 'increase' | 'decrease' | 'adjustment';
      notes?: string;
    }) => {
      // Update product stock
      const { error: updateError } = await supabase
        .from('products')
        .update({ current_stock: newStock })
        .eq('id', productId);

      if (updateError) throw updateError;

      // Record in stock history
      const { error: historyError } = await supabase.from('stock_history').insert({
        product_id: productId,
        previous_stock: currentStock,
        new_stock: newStock,
        change_amount: newStock - currentStock,
        change_type: changeType,
        notes,
        changed_by: user?.id,
      });

      if (historyError) throw historyError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['stock-history'] });
      toast({ title: 'Stock updated successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update stock', description: error.message, variant: 'destructive' });
    },
  });
}
