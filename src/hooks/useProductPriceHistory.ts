import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ProductPriceHistoryEntry {
  id: string;
  product_id: string;
  organization_id: string;
  previous_cost_price: number;
  new_cost_price: number;
  previous_selling_price: number;
  new_selling_price: number;
  change_type: string;
  notes: string | null;
  changed_by: string | null;
  created_at: string;
  changer_name?: string | null;
  product_name?: string | null;
}

export function useProductPriceHistory(productId?: string) {
  return useQuery({
    queryKey: ['product-price-history', productId ?? 'all'],
    queryFn: async () => {
      let query = supabase
        .from('product_price_history')
        .select('*')
        .order('created_at', { ascending: false });

      if (productId) query = query.eq('product_id', productId);

      const { data, error } = await query;
      if (error) throw error;

      const entries = (data ?? []) as ProductPriceHistoryEntry[];

      // Resolve changer names
      const userIds = Array.from(
        new Set(entries.map((e) => e.changed_by).filter((id): id is string => !!id))
      );
      let nameMap = new Map<string, string>();
      if (userIds.length > 0) {
        const { data: names } = await supabase.rpc('get_org_user_names', { _user_ids: userIds });
        (names ?? []).forEach((n: { user_id: string; full_name: string | null; email: string | null }) => {
          nameMap.set(n.user_id, n.full_name || n.email?.split('@')[0] || '');
        });
      }

      // Resolve product names if no productId filter
      let productMap = new Map<string, string>();
      if (!productId) {
        const productIds = Array.from(new Set(entries.map((e) => e.product_id)));
        if (productIds.length > 0) {
          const { data: products } = await supabase
            .from('products')
            .select('id, name')
            .in('id', productIds);
          (products ?? []).forEach((p) => productMap.set(p.id, p.name));
        }
      }

      return entries.map((e) => ({
        ...e,
        changer_name: e.changed_by ? nameMap.get(e.changed_by) ?? null : null,
        product_name: productMap.get(e.product_id) ?? null,
      }));
    },
  });
}