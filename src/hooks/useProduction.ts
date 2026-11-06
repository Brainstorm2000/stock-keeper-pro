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
  batch_id?: string;
  batch_initial_quantity?: number;
  expiration_date?: string | null;
  batch_source_type?: string;
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

      const history = data as unknown as ManualProductionRecord[];
      const historyIds = history.map((record) => record.id);
      if (historyIds.length === 0) return history;

      const { data: batches, error: batchesError } = await supabase
        .from("inventory_batches")
        .select("id, source_id, expiration_date, initial_quantity, source_type")
        .in("source_id", historyIds)
        .in("source_type", ["manual_production", "manual_production_deleted"]);
      if (batchesError) throw batchesError;

      const batchesByHistoryId = new Map(
        batches.map((batch) => [batch.source_id, batch]),
      );
      return history.map((record) => ({
        ...record,
        batch_id: batchesByHistoryId.get(record.id)?.id,
        batch_initial_quantity: batchesByHistoryId.get(record.id)?.initial_quantity,
        expiration_date: batchesByHistoryId.get(record.id)?.expiration_date,
        batch_source_type: batchesByHistoryId.get(record.id)?.source_type,
      }));
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
      expirationDate,
    }: {
      productId: string;
      quantity: number;
      notes?: string;
      expirationDate?: string | null;
    }) => {
      if (!user?.id) throw new Error("You must be signed in to record production.");
      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new Error("Production quantity must be greater than zero.");
      }

      const { error } = await supabase.rpc("record_manual_production", {
        _product_id: productId,
        _quantity: quantity,
        _notes: notes?.trim() || null,
        _expiration_date: expirationDate || null,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["stock-history"] });
      queryClient.invalidateQueries({ queryKey: ["manual-production-history"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-batches"] });
      toast({ title: "Production recorded and stock updated" });
    },
    onError: (error: Error) => {
      const { title, description } = parseDbError(error, "record production");
      toast({ title, description, variant: "destructive" });
    },
  });
}

export function useUpdateManualProduction() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      historyId,
      quantity,
      notes,
      expirationDate,
    }: {
      historyId: string;
      quantity: number;
      notes?: string;
      expirationDate?: string | null;
    }) => {
      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new Error("Production quantity must be greater than zero.");
      }

      const { error } = await supabase.rpc("update_manual_production", {
        _history_id: historyId,
        _quantity: quantity,
        _notes: notes?.trim() || null,
        _expiration_date: expirationDate || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["stock-history"] });
      queryClient.invalidateQueries({ queryKey: ["manual-production-history"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-batches"] });
      toast({ title: "Production record updated" });
    },
    onError: (error: Error) => {
      const { title, description } = parseDbError(error, "update production");
      toast({ title, description, variant: "destructive" });
    },
  });
}

export function useDeleteManualProduction() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (historyId: string) => {
      const { error } = await supabase.rpc("delete_manual_production", {
        _history_id: historyId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["stock-history"] });
      queryClient.invalidateQueries({ queryKey: ["manual-production-history"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-batches"] });
      toast({ title: "Production record deleted and stock adjusted" });
    },
    onError: (error: Error) => {
      const { title, description } = parseDbError(error, "delete production");
      toast({ title, description, variant: "destructive" });
    },
  });
}
