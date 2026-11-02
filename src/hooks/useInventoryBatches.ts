import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface InventoryBatch {
  id: string;
  organization_id: string;
  branch_id: string | null;
  product_id: string | null;
  variation_id: string | null;
  raw_material_id: string | null;
  purchase_item_id: string | null;
  batch_number: string;
  expiration_date: string | null;
  initial_quantity: number;
  remaining_quantity: number;
  unit_cost: number;
  source_type: string;
  source_id: string | null;
  created_at: string;
}

export function useInventoryBatches(
  productId?: string | null,
  enabled = true,
) {
  return useQuery({
    queryKey: ["inventory-batches", productId],
    enabled,
    queryFn: async () => {
      let query = supabase
        .from("inventory_batches")
        .select("*")
        .order("expiration_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true });

      if (productId) query = query.eq("product_id", productId);

      const { data, error } = await query;
      if (error) throw error;
      return data as InventoryBatch[];
    },
  });
}
