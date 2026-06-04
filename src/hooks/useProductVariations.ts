import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { parseDbError } from '@/lib/db-errors';

export interface ProductAttribute {
  id: string;
  organization_id: string;
  name: string;
  values?: ProductAttributeValue[];
}

export interface ProductAttributeValue {
  id: string;
  attribute_id: string;
  value: string;
  sort_order: number;
}

export interface VariationAttributePair {
  attribute_id: string;
  attribute_name: string;
  value_id: string;
  value: string;
}

export interface ProductVariation {
  id: string;
  product_id: string;
  organization_id: string;
  sku: string | null;
  opening_stock: number;
  current_stock: number;
  low_stock_threshold: number;
  out_of_stock_threshold: number;
  cost_price: number;
  selling_price: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  attributes?: VariationAttributePair[];
}

export function useProductAttributes() {
  return useQuery({
    queryKey: ['product-attributes'],
    queryFn: async () => {
      const { data: attrs, error } = await supabase
        .from('product_attributes' as any)
        .select('*')
        .order('name');
      if (error) throw error;
      const { data: vals, error: vErr } = await supabase
        .from('product_attribute_values' as any)
        .select('*')
        .order('sort_order');
      if (vErr) throw vErr;
      const valuesByAttr = new Map<string, ProductAttributeValue[]>();
      ((vals as any) || []).forEach((v: any) => {
        const arr = valuesByAttr.get(v.attribute_id) || [];
        arr.push(v);
        valuesByAttr.set(v.attribute_id, arr);
      });
      return ((attrs as any) || []).map((a: any) => ({
        ...a,
        values: valuesByAttr.get(a.id) || [],
      })) as ProductAttribute[];
    },
  });
}

export function useCreateAttribute() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ name, organization_id }: { name: string; organization_id: string }) => {
      const { data, error } = await supabase
        .from('product_attributes' as any)
        .insert({ name: name.trim(), organization_id })
        .select()
        .single();
      if (error) throw error;
      return data as any;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['product-attributes'] }),
    onError: (e: Error) => {
      const { title, description } = parseDbError(e, 'create attribute');
      toast({ title, description, variant: 'destructive' });
    },
  });
}

export function useCreateAttributeValue() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ attribute_id, value }: { attribute_id: string; value: string }) => {
      const { data, error } = await supabase
        .from('product_attribute_values' as any)
        .insert({ attribute_id, value: value.trim() })
        .select()
        .single();
      if (error) throw error;
      return data as any;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['product-attributes'] }),
    onError: (e: Error) => {
      const { title, description } = parseDbError(e, 'add value');
      toast({ title, description, variant: 'destructive' });
    },
  });
}

export async function fetchVariationsForProduct(productId: string): Promise<ProductVariation[]> {
  const { data: variations, error } = await supabase
    .from('product_variations' as any)
    .select('*')
    .eq('product_id', productId)
    .order('created_at');
  if (error) throw error;
  const variationIds = ((variations as any) || []).map((v: any) => v.id);
  if (variationIds.length === 0) return [];
  const { data: links, error: lErr } = await supabase
    .from('product_variation_attributes' as any)
    .select('variation_id, attribute_id, value_id, product_attributes(name), product_attribute_values(value)')
    .in('variation_id', variationIds);
  if (lErr) throw lErr;
  const linksByVariation = new Map<string, VariationAttributePair[]>();
  ((links as any) || []).forEach((l: any) => {
    const arr = linksByVariation.get(l.variation_id) || [];
    arr.push({
      attribute_id: l.attribute_id,
      attribute_name: l.product_attributes?.name || '',
      value_id: l.value_id,
      value: l.product_attribute_values?.value || '',
    });
    linksByVariation.set(l.variation_id, arr);
  });
  return ((variations as any) || []).map((v: any) => ({
    ...v,
    attributes: linksByVariation.get(v.id) || [],
  })) as ProductVariation[];
}

export function useProductVariations(productId: string | null | undefined) {
  return useQuery({
    queryKey: ['product-variations', productId],
    queryFn: () => fetchVariationsForProduct(productId!),
    enabled: !!productId,
  });
}

export function formatVariationLabel(v: ProductVariation): string {
  if (!v.attributes || v.attributes.length === 0) return v.sku || 'Variation';
  return v.attributes.map((a) => `${a.attribute_name}: ${a.value}`).join(' / ');
}

export interface VariationDraft {
  id?: string; // existing variation id
  attribute_value_ids: { attribute_id: string; value_id: string }[];
  sku: string;
  opening_stock: number;
  current_stock: number;
  low_stock_threshold: number;
  out_of_stock_threshold: number;
  cost_price: number;
  selling_price: number;
  is_active: boolean;
}

/**
 * Replace the set of variations for a product. Variations not present
 * in `drafts` (by id) are deleted. New drafts (no id) are inserted.
 * Returns the saved variations.
 */
export async function saveProductVariations(
  productId: string,
  organizationId: string,
  drafts: VariationDraft[],
): Promise<void> {
  const existing = await fetchVariationsForProduct(productId);
  const keepIds = new Set(drafts.filter((d) => d.id).map((d) => d.id!));
  const toDelete = existing.filter((e) => !keepIds.has(e.id)).map((e) => e.id);
  if (toDelete.length > 0) {
    const { error } = await supabase
      .from('product_variations' as any)
      .delete()
      .in('id', toDelete);
    if (error) throw error;
  }

  for (const draft of drafts) {
    const payload = {
      product_id: productId,
      organization_id: organizationId,
      sku: draft.sku?.trim() || null,
      opening_stock: draft.opening_stock || 0,
      current_stock: draft.current_stock || 0,
      low_stock_threshold: draft.low_stock_threshold || 0,
      out_of_stock_threshold: draft.out_of_stock_threshold || 0,
      cost_price: draft.cost_price || 0,
      selling_price: draft.selling_price || 0,
      is_active: draft.is_active,
    };
    let variationId = draft.id;
    if (variationId) {
      const { error } = await supabase
        .from('product_variations' as any)
        .update(payload)
        .eq('id', variationId);
      if (error) throw error;
      // Replace attribute links
      await supabase
        .from('product_variation_attributes' as any)
        .delete()
        .eq('variation_id', variationId);
    } else {
      const { data, error } = await supabase
        .from('product_variations' as any)
        .insert(payload)
        .select('id')
        .single();
      if (error) throw error;
      variationId = (data as any).id;
    }
    if (draft.attribute_value_ids.length > 0) {
      const rows = draft.attribute_value_ids.map((p) => ({
        variation_id: variationId,
        attribute_id: p.attribute_id,
        value_id: p.value_id,
      }));
      const { error } = await supabase
        .from('product_variation_attributes' as any)
        .insert(rows);
      if (error) throw error;
    }
  }
}