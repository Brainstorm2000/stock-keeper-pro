import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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

export function useUpdateInventoryBatchExpiration() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ batchId, expirationDate }: { batchId: string; expirationDate: string | null }) => {
      const { data, error } = await supabase
        .from("inventory_batches")
        .update({ expiration_date: expirationDate })
        .eq("id", batchId)
        .select("id")
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error("Batch expiry was not updated. Check your organization access.");
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["inventory-batches"] }),
        queryClient.invalidateQueries({ queryKey: ["products"] }),
        queryClient.invalidateQueries({ queryKey: ["purchases"] }),
      ]);
      toast({ title: "Batch expiry updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Could not update batch expiry", description: error.message, variant: "destructive" });
    },
  });
}
