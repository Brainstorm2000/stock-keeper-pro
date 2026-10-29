import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { parseDbError } from "@/lib/db-errors";

export interface ManualProductionRecord {
  id: string;
  product_id: string;
  change_amount: number;
  notes: string | null;
  created_at: string;
  products?: {
    id: string;
    name: string;
    branch_id: string;
    sub_unit_id: string | null;
    sub_unit_factor: number;
    units?: { abbreviation: string | null };
    sub_units?: { abbreviation: string | null } | null;
    branches?: { name: string } | null;
  };
}

export function useManualProductionHistory() {
  const { organizationId } = useAuth();

  return useQuery({
    queryKey: ["manual-production-history", organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("stock_history")
        .select(`
          id, product_id, change_amount, notes, created_at,
          products (
            id, name, branch_id, sub_unit_id, sub_unit_factor,
            units:units!products_unit_id_fkey (abbreviation), sub_units:units!products_sub_unit_id_fkey (abbreviation),
            branches (name)
          )
        `)
        .eq("change_type", "manual_production")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as unknown as ManualProductionRecord[];
    },
  });
}

export function useRecordManualProduction() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      productId,
      quantity,
      notes,
    }: {
      productId: string;
      quantity: number;
      notes?: string;
    }) => {
      if (!user?.id) throw new Error("You must be signed in to record production.");
      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new Error("Production quantity must be greater than zero.");
      }

      const { error } = await supabase.rpc("record_manual_production", {
        _product_id: productId,
        _quantity: quantity,
        _notes: notes?.trim() || null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["stock-history"] });
      queryClient.invalidateQueries({ queryKey: ["manual-production-history"] });
      toast({ title: "Production recorded and stock updated" });
    },
    onError: (error: Error) => {
      const { title, description } = parseDbError(error, "record production");
      toast({ title, description, variant: "destructive" });
    },
  });
}
