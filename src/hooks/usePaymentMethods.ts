import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { parseDbError } from "@/lib/db-errors";
import type { PaymentMethod } from "@/hooks/useSales";

export interface OrgPaymentMethod {
  id: string;
  organization_id: string;
  name: string;
  icon: string;
  mapped_type: PaymentMethod;
  is_active: boolean;
  is_builtin: boolean;
  sort_order: number;
}

export function usePaymentMethods(activeOnly = false) {
  const { organizationId } = useAuth();
  return useQuery({
    queryKey: ["payment-methods", organizationId, activeOnly],
    enabled: !!organizationId,
    queryFn: async () => {
      let q = supabase
        .from("payment_methods" as any)
        .select("*")
        .eq("organization_id", organizationId!)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
      if (activeOnly) q = q.eq("is_active", true);
      const { data, error } = await q;
      if (error) throw error;
      return (data as any as OrgPaymentMethod[]) || [];
    },
  });
}

export function useCreatePaymentMethod() {
  const qc = useQueryClient();
  const { organizationId } = useAuth();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      icon: string;
      mapped_type: PaymentMethod;
    }) => {
      if (!organizationId) throw new Error("No organization");
      const { data, error } = await supabase
        .from("payment_methods" as any)
        .insert({ organization_id: organizationId, ...input })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payment-methods"] });
      toast({ title: "Payment method created" });
    },
    onError: (e: Error) => {
      const { title, description } = parseDbError(e, "create payment method");
      toast({ title, description, variant: "destructive" });
    },
  });
}

export function useUpdatePaymentMethod() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: Partial<OrgPaymentMethod> & { id: string }) => {
      const { error } = await supabase
        .from("payment_methods" as any)
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payment-methods"] });
      toast({ title: "Payment method updated" });
    },
    onError: (e: Error) => {
      const { title, description } = parseDbError(e, "update payment method");
      toast({ title, description, variant: "destructive" });
    },
  });
}

export function useDeletePaymentMethod() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("payment_methods" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["payment-methods"] });
      toast({ title: "Payment method deleted" });
    },
    onError: (e: Error) => {
      const { title, description } = parseDbError(e, "delete payment method");
      toast({ title, description, variant: "destructive" });
    },
  });
}