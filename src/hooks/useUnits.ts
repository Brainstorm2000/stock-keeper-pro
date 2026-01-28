import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';

export interface Unit {
  id: string;
  name: string;
  abbreviation: string | null;
  created_at: string;
  updated_at: string;
}

export interface UnitInput {
  name: string;
  abbreviation?: string;
}

export function useUnits() {
  return useQuery({
    queryKey: ['units'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('units')
        .select('*')
        .order('name');

      if (error) throw error;
      return data as Unit[];
    },
  });
}

export function useCreateUnit() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (unit: UnitInput) => {
      const { data, error } = await supabase
        .from('units')
        .insert({
          ...unit,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['units'] });
      toast({ title: 'Unit created successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create unit', description: error.message, variant: 'destructive' });
    },
  });
}

export function useUpdateUnit() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...unit }: UnitInput & { id: string }) => {
      const { data, error } = await supabase
        .from('units')
        .update(unit)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['units'] });
      toast({ title: 'Unit updated successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update unit', description: error.message, variant: 'destructive' });
    },
  });
}

export function useDeleteUnit() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('units').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['units'] });
      toast({ title: 'Unit deleted successfully' });
    },
    onError: (error: Error) => {
      const isInUse = error.message.includes('violates foreign key constraint');
      toast({ 
        title: isInUse ? 'Cannot delete unit' : 'Failed to delete unit', 
        description: isInUse 
          ? 'This unit is being used by one or more products. Remove or reassign those products first.' 
          : error.message, 
        variant: 'destructive' 
      });
    },
  });
}
