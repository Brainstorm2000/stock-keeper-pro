import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

export interface WhtCredit {
  id: string;
  organization_id: string;
  credit_date: string;
  payer_name: string;
  reference: string | null;
  amount: number;
  notes: string | null;
}

export function useWhtCredits() {
  return useQuery({
    queryKey: ["tax-wht-credits"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tax_wht_credits")
        .select("*")
        .order("credit_date", { ascending: false });
      if (error) throw error;
      return data as WhtCredit[];
    },
  });
}

export function useCreateWhtCredit() {
  const queryClient = useQueryClient();
  const { user, organizationId } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: Omit<WhtCredit, "id" | "organization_id">) => {
      if (!organizationId) throw new Error("Organization not found");
      const { data, error } = await supabase
        .from("tax_wht_credits")
        .insert({ ...input, organization_id: organizationId, created_by: user?.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tax-wht-credits"] });
      toast({ title: "WHT credit recorded" });
    },
    onError: (error: Error) => toast({ title: "Could not record WHT credit", description: error.message, variant: "destructive" }),
  });
}

export function useUpdateWhtCredit() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...input }: Omit<WhtCredit, "organization_id">) => {
      const { data, error } = await supabase
        .from("tax_wht_credits")
        .update(input)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tax-wht-credits"] });
      toast({ title: "WHT credit updated" });
    },
    onError: (error: Error) => toast({ title: "Could not update WHT credit", description: error.message, variant: "destructive" }),
  });
}

export function useDeleteWhtCredit() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tax_wht_credits").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tax-wht-credits"] });
      toast({ title: "WHT credit deleted" });
    },
    onError: (error: Error) => toast({ title: "Could not delete WHT credit", description: error.message, variant: "destructive" }),
  });
}