import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { parseDbError } from '@/lib/db-errors';

export interface ProductCategoryOption {
  id: string;
  organization_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export function useProductCategories() {
  const { organizationId } = useAuth();

  return useQuery({
    queryKey: ['product-categories', organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_categories' as any)
        .select('*')
        .eq('organization_id', organizationId!)
        .order('name');
      if (error) throw error;
      return (data || []) as ProductCategoryOption[];
    },
  });
}

export function useCreateProductCategory() {
  const queryClient = useQueryClient();
  const { user, organizationId } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (name: string) => {
      const trimmedName = name.trim();
      if (!trimmedName) throw new Error('Category name is required.');
      if (!organizationId) throw new Error('No organization found.');

      const { data, error } = await supabase
        .from('product_categories' as any)
        .insert({
          organization_id: organizationId,
          name: trimmedName,
          created_by: user?.id,
        })
        .select()
        .single();
      if (error) throw error;
      return data as ProductCategoryOption;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-categories'] });
      toast({ title: 'Product category created' });
    },
    onError: (error: Error) => {
      const { title, description } = parseDbError(error, 'create product category');
      toast({ title, description, variant: 'destructive' });
    },
  });
}

export function useUpdateProductCategory() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const trimmedName = name.trim();
      if (!trimmedName) throw new Error('Category name is required.');

      const { data, error } = await supabase
        .from('product_categories' as any)
        .update({ name: trimmedName, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as ProductCategoryOption;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-categories'] });
      toast({ title: 'Product category updated' });
    },
    onError: (error: Error) => {
      const { title, description } = parseDbError(error, 'update product category');
      toast({ title, description, variant: 'destructive' });
    },
  });
}

export function useDeleteProductCategory() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('product_categories' as any)
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product-categories'] });
      toast({ title: 'Product category deleted' });
    },
    onError: (error: Error) => {
      const { title, description } = parseDbError(error, 'delete product category');
      toast({ title, description, variant: 'destructive' });
    },
  });
}
