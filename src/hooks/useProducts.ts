import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { parseDbError } from '@/lib/db-errors';
import { generateSku } from '@/lib/sku';
import { productsTable, readLocalFirst, saveLocal, removeLocal } from '@/lib/offline/repository';
import { createId } from '@/lib/utils';
import { getProductType, type ProductType } from '@/lib/product-type';

export { getProductType } from '@/lib/product-type';
export type { ProductType } from '@/lib/product-type';

export type ItemType = 'product' | 'service' | 'variable';
export type ProductCategory = 'sellable' | 'consumable';
export interface Product {
  id: string;
  name: string;
  generic_name: string | null;
  manufacturing_date: string | null;
  nafdac_number: string | null;
  unit_id: string;
  sub_unit_id: string | null;
  sub_unit_factor: number;
  sub_unit_selling_price: number | null;
  branch_id: string;
  supplier_id: string | null;
  brand_id: string | null;
  product_category_id: string | null;
  opening_stock: number;
  current_stock: number;
  low_stock_threshold: number;
  out_of_stock_threshold: number;
  sku: string | null;
  description: string | null;
  category: ProductCategory;
  is_taxable: boolean;
  item_type: ItemType;
  cost_price: number;
  selling_price: number;
  expiration_date: string | null;
  is_archived: boolean;
  created_at: string;
  updated_at: string;
  units?: {
    id: string;
    name: string;
    abbreviation: string | null;
  };
  sub_units?: {
    id: string;
    name: string;
    abbreviation: string | null;
  } | null;
  branches?: {
    id: string;
    name: string;
  };
  suppliers?: {
    id: string;
    name: string;
  };
  brands?: {
    id: string;
    name: string;
  };
  product_categories?: {
    id: string;
    name: string;
  } | null;
  variations?: Array<{
    id: string;
    current_stock: number;
    cost_price: number;
    selling_price: number;
  }>;
}

export interface ProductInput {
  name: string;
  generic_name?: string | null;
  manufacturing_date?: string | null;
  nafdac_number?: string | null;
  unit_id: string;
  sub_unit_id?: string | null;
  sub_unit_factor?: number;
  sub_unit_selling_price?: number | null;
  branch_id: string;
  supplier_id?: string;
  brand_id?: string;
  product_category_id?: string | null;
  opening_stock: number;
  current_stock: number;
  low_stock_threshold: number;
  out_of_stock_threshold: number;
  sku?: string;
  description?: string;
  item_type?: ItemType;
  category?: ProductCategory;
  is_taxable?: boolean;
  cost_price?: number;
  selling_price?: number;
  expiration_date?: string | null;
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
  excludeProductId?: string,
  skuScopedToBranch = false,
): Promise<DuplicateCheckResult> {
  // Check for name + branch duplicate
  let query = supabase
    .from('products')
    .select('id, name, sku, branch_id, current_stock, item_type')
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
      .select('id, name, sku, branch_id, current_stock, item_type')
      .ilike('sku', sku.trim());

    if (excludeProductId) {
      skuQuery = skuQuery.neq('id', excludeProductId);
    }
    if (skuScopedToBranch && branchId) {
      skuQuery = skuQuery.eq('branch_id', branchId);
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

export function useProducts(options?: { includeArchived?: boolean }) {
  const includeArchived = options?.includeArchived ?? false;
  const { organizationId } = useAuth();
  return useQuery({
    queryKey: ['products', organizationId, { includeArchived }],
    enabled: !!organizationId,
    queryFn: async () => {
      const products = await readLocalFirst(productsTable, async () => {
        let query = supabase
          .from('products')
          .select(`
          *,
          units:units!products_unit_id_fkey (id, name, abbreviation),
          sub_units:units!products_sub_unit_id_fkey (id, name, abbreviation),
          branches (id, name),
          suppliers (id, name),
          brands (id, name),
          product_categories (id, name)
          `)
          .order('name');
        query = query.eq('organization_id', organizationId!);
        if (!includeArchived) query = query.eq('is_archived', false);
        const { data, error } = await query;

        if (error) throw error;
        return data as Product[];
      }, (product) => product.organization_id === organizationId);
      const visibleProducts = (products as Product[]).filter((p) => includeArchived || !p.is_archived);

      // Attach variations for variable products
      const variableIds = visibleProducts
        .filter((p) => p.item_type === 'variable')
        .map((p) => p.id);
      if (variableIds.length > 0) {
        const { data: vars } = await supabase
          .from('product_variations' as never)
          .select('id, product_id, current_stock, cost_price, selling_price')
          .in('product_id', variableIds);
        type VarRow = NonNullable<Product['variations']>[number];
        const byProduct = new Map<string, VarRow[]>();
        ((vars as unknown as Array<{ id: string; product_id: string; current_stock: number; cost_price: number; selling_price: number }>) || []).forEach((v) => {
          const arr = byProduct.get(v.product_id) || [];
          arr.push({
            id: v.id,
            current_stock: Number(v.current_stock),
            cost_price: Number(v.cost_price),
            selling_price: Number(v.selling_price),
          });
          byProduct.set(v.product_id, arr);
        });
        visibleProducts.forEach((p) => {
          if (p.item_type === 'variable') {
            p.variations = byProduct.get(p.id) || [];
          }
        });
      }
      return visibleProducts;
    },
  });
}

export function useCreateProduct() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (product: ProductInput & { organization_id: string }) => {
      if (!user?.id) throw new Error('You must be signed in to create products.');
      const actorId = user.id;

      // Auto-generate SKU when not provided
      const sku = product.sku && product.sku.trim()
        ? product.sku.trim()
        : generateSku(product.item_type === 'service' ? 'SRV' : product.category === 'consumable' ? 'CON' : 'PRD');

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        const now = new Date().toISOString();
        return saveLocal(productsTable, {
          ...product,
          id: createId(),
          sku,
          created_by: actorId,
          organization_id: product.organization_id,
          created_at: now,
          updated_at: now,
          supplier_id: product.supplier_id ?? null,
          brand_id: product.brand_id ?? null,
          description: product.description ?? null,
          expiration_date: product.expiration_date ?? null,
          item_type: product.item_type ?? 'product',
          category: product.category ?? 'sellable',
          is_taxable: product.is_taxable ?? true,
          cost_price: product.cost_price ?? 0,
          selling_price: product.selling_price ?? 0,
          is_archived: false,
        } as Product);
      }

      const { data, error } = await supabase
        .from('products')
        .insert({
          ...product,
          sku,
          created_by: actorId,
          organization_id: product.organization_id,
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
        changed_by: actorId,
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({ title: 'Product created successfully' });
    },
    onError: (error: Error) => {
      const { title, description } = parseDbError(error, 'create product');
      toast({ title, description, variant: 'destructive' });
    },
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...product }: ProductInput & { id: string }) => {
      const existing = await productsTable.get(id);
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        if (!existing) throw new Error('Product is not available in the offline cache.');
        const previousStock = Number(existing.data.current_stock);
        const nextStock = Number(product.current_stock ?? previousStock);
        if (
          previousStock !== nextStock &&
          existing.data.item_type !== 'service' &&
          (product.item_type ?? existing.data.item_type) !== 'service'
        ) {
          throw new Error('Reconnect to change stock so the adjustment can be recorded against inventory batches.');
        }
        const updated = await saveLocal(productsTable, { ...existing.data, ...product, id } as Product);
        return updated;
      }

      const { data: previousProduct, error: previousProductError } = await supabase
        .from('products')
        .select('current_stock, item_type')
        .eq('id', id)
        .single();

      if (previousProductError) throw previousProductError;

      const previousStock = Number(previousProduct.current_stock);
      const nextStock = Number(product.current_stock ?? previousStock);
      const productType = product.item_type ?? previousProduct.item_type;
      const productFields = { ...product };
      delete productFields.current_stock;
      const { data, error } = await supabase
        .from('products')
        .update(
          previousProduct.item_type === 'product' && productType === 'product'
            ? productFields
            : product,
        )
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;

      if (previousProduct.item_type === 'product' && productType === 'product' && previousStock !== nextStock) {
        const { error: adjustmentError } = await supabase.rpc('adjust_product_batch_stock', {
          _product_id: id,
          _change_amount: nextStock - previousStock,
          _notes: 'Stock adjusted while editing product',
        });
        if (adjustmentError) throw adjustmentError;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['stock-history'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-batches'] });
      toast({ title: 'Product updated successfully' });
    },
    onError: (error: Error) => {
      const { title, description } = parseDbError(error, 'update product');
      toast({ title, description, variant: 'destructive' });
    },
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        await removeLocal(productsTable, id);
        return;
      }
      const { data, error } = await supabase
        .from('products')
        .delete()
        .eq('id', id)
        .select('id')
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error('Product was not deleted. Check that you have delete access and an active subscription.');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({ title: 'Product deleted successfully' });
    },
    onError: (error: Error) => {
      const { title, description } = parseDbError(error, 'Product');
      toast({ title, description, variant: 'destructive' });
    },
  });
}

export function useBulkDeleteProducts() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (ids: string[]) => {
      if (!ids.length) return;
      const { data, error } = await supabase.from('products').delete().in('id', ids).select('id');
      if (error) throw error;
      if ((data?.length ?? 0) !== ids.length) {
        throw new Error('Some products were not deleted. Check that you have delete access and an active subscription.');
      }
    },
    onSuccess: (_, ids) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({ title: `Deleted ${ids.length} product${ids.length === 1 ? '' : 's'}` });
    },
    onError: (error: Error) => {
      const { title, description } = parseDbError(error, 'Product');
      toast({ title, description, variant: 'destructive' });
    },
  });
}

export function useBulkUpdateProducts() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ ids, patch }: { ids: string[]; patch: Record<string, unknown> }) => {
      if (!ids.length) return;
      if (!Object.prototype.hasOwnProperty.call(patch, 'current_stock')) {
        const { error } = await supabase.from('products').update(patch).in('id', ids);
        if (error) throw error;
        return;
      }

      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id, current_stock, item_type')
        .in('id', ids);
      if (productsError) throw productsError;
      const requestedStock = Number(patch.current_stock);
      if (!Number.isFinite(requestedStock) || requestedStock < 0) {
        throw new Error('Stock must be a non-negative number.');
      }

      const metadataPatch = { ...patch };
      delete metadataPatch.current_stock;
      if (Object.keys(metadataPatch).length > 0) {
        const { error } = await supabase.from('products').update(metadataPatch).in('id', ids);
        if (error) throw error;
      }

      for (const product of products || []) {
        if (product.item_type !== 'product') continue;
        const changeAmount = requestedStock - Number(product.current_stock);
        if (changeAmount === 0) continue;
        const { error } = await supabase.rpc('adjust_product_batch_stock', {
          _product_id: product.id,
          _change_amount: changeAmount,
          _notes: 'Stock adjusted during bulk product edit',
        });
        if (error) throw error;
      }
    },
    onSuccess: (_, { ids }) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({ title: `Updated ${ids.length} product${ids.length === 1 ? '' : 's'}` });
    },
    onError: (error: Error) => {
      const { title, description } = parseDbError(error, 'update products');
      toast({ title, description, variant: 'destructive' });
    },
  });
}

export function useArchiveProduct() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, archived }: { id: string; archived: boolean }) => {
      const { data, error } = await supabase
        .from('products')
        .update({ is_archived: archived })
        .eq('id', id)
        .select('id')
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        throw new Error(`Product was not ${archived ? 'archived' : 'restored'}. Check that you have edit access and an active subscription.`);
      }
    },
    onSuccess: (_, { archived }) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast({ title: archived ? 'Item archived' : 'Item restored' });
    },
    onError: (error: Error) => {
      const { title, description } = parseDbError(error, 'archive product');
      toast({ title, description, variant: 'destructive' });
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
      notes,
      batchNumber,
      expirationDate,
    }: {
      productId: string;
      currentStock: number;
      newStock: number;
      notes?: string;
      batchNumber?: string;
      expirationDate?: string | null;
    }) => {
      if (!user?.id) throw new Error('You must be signed in to update stock.');
      const { error } = await supabase.rpc('adjust_product_batch_stock', {
        _product_id: productId,
        _change_amount: newStock - currentStock,
        _batch_number: batchNumber?.trim() || null,
        _expiration_date: expirationDate || null,
        _notes: notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['stock-history'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-batches'] });
      toast({ title: 'Stock updated successfully' });
    },
    onError: (error: Error) => {
      const { title, description } = parseDbError(error, 'update stock');
      toast({ title, description, variant: 'destructive' });
    },
  });
}
