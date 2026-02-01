import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { parseDbError } from '@/lib/db-errors';

export interface Brand {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface BrandInput {
  name: string;
  description?: string;
}

export function useBrands() {
  return useQuery({
    queryKey: ['brands'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('brands')
        .select('*')
        .order('name');

      if (error) throw error;
      return data as Brand[];
    },
  });
}

export function useCreateBrand() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (brand: BrandInput & { organization_id: string }) => {
      const { data, error } = await supabase
        .from('brands')
        .insert({
          ...brand,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brands'] });
      toast({ title: 'Brand created successfully' });
    },
    onError: (error: Error) => {
      const { title, description } = parseDbError(error, 'create brand');
      toast({ title, description, variant: 'destructive' });
    },
  });
}

export function useUpdateBrand() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...brand }: BrandInput & { id: string }) => {
      const { data, error } = await supabase
        .from('brands')
        .update(brand)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brands'] });
      toast({ title: 'Brand updated successfully' });
    },
    onError: (error: Error) => {
      const { title, description } = parseDbError(error, 'update brand');
      toast({ title, description, variant: 'destructive' });
    },
  });
}

export function useDeleteBrand() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('brands').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brands'] });
      toast({ title: 'Brand deleted successfully' });
    },
    onError: (error: Error) => {
      const { title, description } = parseDbError(error, 'Brand');
      toast({ title, description, variant: 'destructive' });
    },
  });
}

export function useBulkCreateBrands() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (brands: (BrandInput & { organization_id: string })[]) => {
      const { data, error } = await supabase
        .from('brands')
        .insert(brands.map(b => ({ ...b, created_by: user?.id })))
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['brands'] });
      toast({ title: `${data.length} brands imported successfully` });
    },
    onError: (error: Error) => {
      const { title, description } = parseDbError(error, 'import brands');
      toast({ title, description, variant: 'destructive' });
    },
  });
}
