import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { parseDbError } from '@/lib/db-errors';

export interface StaffPosition {
  id: string;
  name: string;
  description: string | null;
  organization_id: string;
}

export function useStaffPositions() {
  return useQuery({
    queryKey: ['staff-positions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('staff_positions')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as StaffPosition[];
    },
  });
}

export function useCreateStaffPosition() {
  const queryClient = useQueryClient();
  const { organizationId } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (name: string) => {
      if (!organizationId) throw new Error('No organization');
      const { data, error } = await supabase
        .from('staff_positions')
        .insert({ name, organization_id: organizationId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-positions'] });
      toast({ title: 'Position created' });
    },
    onError: (error: Error) => {
      const { title, description } = parseDbError(error, 'create position');
      toast({ title, description, variant: 'destructive' });
    },
  });
}

export function useCreateDepartment() {
  const queryClient = useQueryClient();
  const { organizationId } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (name: string) => {
      if (!organizationId) throw new Error('No organization');
      const { data, error } = await supabase
        .from('departments')
        .insert({ name, organization_id: organizationId })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      toast({ title: 'Department created' });
    },
    onError: (error: Error) => {
      const { title, description } = parseDbError(error, 'create department');
      toast({ title, description, variant: 'destructive' });
    },
  });
}
