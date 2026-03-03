import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { parseDbError } from '@/lib/db-errors';

export interface BOMItem {
  id: string;
  bom_id: string;
  raw_material_id: string;
  quantity_required: number;
  raw_materials?: {
    id: string;
    name: string;
    cost_per_unit: number;
    current_stock: number;
    units?: { id: string; name: string; abbreviation: string | null };
  };
}

export interface BOM {
  id: string;
  organization_id: string;
  product_id: string;
  name: string;
  description: string | null;
  labor_cost_per_unit: number;
  overhead_cost_per_unit: number;
  created_at: string;
  updated_at: string;
  products?: { id: string; name: string; selling_price: number };
  bom_items?: BOMItem[];
}

export interface BOMInput {
  product_id: string;
  name: string;
  description?: string;
  labor_cost_per_unit?: number;
  overhead_cost_per_unit?: number;
  items: { raw_material_id: string; quantity_required: number }[];
}

export function useBOMs() {
  return useQuery({
    queryKey: ['boms'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bill_of_materials')
        .select(`
          *,
          products (id, name, selling_price),
          bom_items (
            id, bom_id, raw_material_id, quantity_required,
            raw_materials (id, name, cost_per_unit, current_stock, units (id, name, abbreviation))
          )
        `)
        .order('name');
      if (error) throw error;
      return data as BOM[];
    },
  });
}

export function useCreateBOM() {
  const queryClient = useQueryClient();
  const { user, organizationId } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ items, ...input }: BOMInput) => {
      if (!organizationId) throw new Error('No organization');

      const { data: bom, error } = await supabase
        .from('bill_of_materials')
        .insert({
          organization_id: organizationId,
          product_id: input.product_id,
          name: input.name,
          description: input.description,
          labor_cost_per_unit: input.labor_cost_per_unit || 0,
          overhead_cost_per_unit: input.overhead_cost_per_unit || 0,
          created_by: user?.id,
        })
        .select()
        .single();
      if (error) throw error;

      if (items.length > 0) {
        const { error: itemsError } = await supabase
          .from('bom_items')
          .insert(items.map((item) => ({ bom_id: bom.id, ...item })));
        if (itemsError) throw itemsError;
      }
      return bom;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boms'] });
      toast({ title: 'BOM created' });
    },
    onError: (error: Error) => {
      const { title, description } = parseDbError(error, 'create BOM');
      toast({ title, description, variant: 'destructive' });
    },
  });
}

export function useUpdateBOM() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, items, ...input }: BOMInput & { id: string }) => {
      const { error } = await supabase
        .from('bill_of_materials')
        .update({
          product_id: input.product_id,
          name: input.name,
          description: input.description,
          labor_cost_per_unit: input.labor_cost_per_unit || 0,
          overhead_cost_per_unit: input.overhead_cost_per_unit || 0,
        })
        .eq('id', id);
      if (error) throw error;

      // Replace items
      await supabase.from('bom_items').delete().eq('bom_id', id);
      if (items.length > 0) {
        const { error: itemsError } = await supabase
          .from('bom_items')
          .insert(items.map((item) => ({ bom_id: id, ...item })));
        if (itemsError) throw itemsError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boms'] });
      toast({ title: 'BOM updated' });
    },
    onError: (error: Error) => {
      const { title, description } = parseDbError(error, 'update BOM');
      toast({ title, description, variant: 'destructive' });
    },
  });
}

export function useDeleteBOM() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('bill_of_materials').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['boms'] });
      toast({ title: 'BOM deleted' });
    },
    onError: (error: Error) => {
      const { title, description } = parseDbError(error, 'BOM');
      toast({ title, description, variant: 'destructive' });
    },
  });
}
