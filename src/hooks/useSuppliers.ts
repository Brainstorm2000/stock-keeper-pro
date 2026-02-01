import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { parseDbError } from '@/lib/db-errors';

export interface Supplier {
  id: string;
  organization_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupplierInput {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
}

export function useSuppliers() {
  return useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .order('name');

      if (error) throw error;
      return data as Supplier[];
    },
  });
}

export function useCreateSupplier() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (supplier: SupplierInput & { organization_id: string }) => {
      const { data, error } = await supabase
        .from('suppliers')
        .insert({
          ...supplier,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast({ title: 'Supplier created successfully' });
    },
    onError: (error: Error) => {
      const { title, description } = parseDbError(error, 'create supplier');
      toast({ title, description, variant: 'destructive' });
    },
  });
}

export function useUpdateSupplier() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...supplier }: SupplierInput & { id: string }) => {
      const { data, error } = await supabase
        .from('suppliers')
        .update(supplier)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast({ title: 'Supplier updated successfully' });
    },
    onError: (error: Error) => {
      const { title, description } = parseDbError(error, 'update supplier');
      toast({ title, description, variant: 'destructive' });
    },
  });
}

export function useDeleteSupplier() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('suppliers').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast({ title: 'Supplier deleted successfully' });
    },
    onError: (error: Error) => {
      const { title, description } = parseDbError(error, 'Supplier');
      toast({ title, description, variant: 'destructive' });
    },
  });
}

export function useBulkCreateSuppliers() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (suppliers: (SupplierInput & { organization_id: string })[]) => {
      const { data, error } = await supabase
        .from('suppliers')
        .insert(suppliers.map(s => ({ ...s, created_by: user?.id })))
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      toast({ title: `${data.length} suppliers imported successfully` });
    },
    onError: (error: Error) => {
      const { title, description } = parseDbError(error, 'import suppliers');
      toast({ title, description, variant: 'destructive' });
    },
  });
}
