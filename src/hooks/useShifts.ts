import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { parseDbError } from '@/lib/db-errors';

export interface Shift {
  id: string;
  organization_id: string;
  shift_name: string;
  start_time: string;
  end_time: string;
  clockin_start_time: string;
  grace_period_minutes: number;
  overtime_start_time: string | null;
  branch_id: string | null;
  department_id: string | null;
  is_active: boolean;
  created_at: string;
  auto_clockout_time: string | null;
  max_overtime_hours: number | null;
  branches?: { id: string; name: string } | null;
  departments?: { id: string; name: string } | null;
}

export interface ShiftInput {
  shift_name: string;
  start_time: string;
  end_time: string;
  clockin_start_time: string;
  grace_period_minutes?: number;
  overtime_start_time?: string | null;
  branch_id?: string | null;
  department_id?: string | null;
  is_active?: boolean;
  auto_clockout_time?: string | null;
  max_overtime_hours?: number | null;
}

export function useShifts() {
  return useQuery({
    queryKey: ['shifts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shifts')
        .select('*, branches(id, name), departments(id, name)')
        .order('shift_name');
      if (error) throw error;
      return data as Shift[];
    },
  });
}

export function useCreateShift() {
  const queryClient = useQueryClient();
  const { user, organizationId } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: ShiftInput) => {
      if (!organizationId) throw new Error('No organization');
      const { data, error } = await supabase
        .from('shifts')
        .insert({
          ...input,
          organization_id: organizationId,
          created_by: user?.id,
          overtime_start_time: input.overtime_start_time || null,
          branch_id: input.branch_id || null,
          department_id: input.department_id || null,
          auto_clockout_time: input.auto_clockout_time || null,
          max_overtime_hours:
            input.max_overtime_hours === undefined || input.max_overtime_hours === null || (input.max_overtime_hours as any) === ''
              ? null
              : Number(input.max_overtime_hours),
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      toast({ title: 'Shift created' });
    },
    onError: (error: Error) => {
      const { title, description } = parseDbError(error, 'create shift');
      toast({ title, description, variant: 'destructive' });
    },
  });
}

export function useUpdateShift() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...input }: ShiftInput & { id: string }) => {
      const { data, error } = await supabase
        .from('shifts')
        .update({
          ...input,
          overtime_start_time: input.overtime_start_time || null,
          branch_id: input.branch_id || null,
          department_id: input.department_id || null,
          auto_clockout_time: input.auto_clockout_time || null,
          max_overtime_hours:
            input.max_overtime_hours === undefined || input.max_overtime_hours === null || (input.max_overtime_hours as any) === ''
              ? null
              : Number(input.max_overtime_hours),
        })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      toast({ title: 'Shift updated' });
    },
    onError: (error: Error) => {
      const { title, description } = parseDbError(error, 'update shift');
      toast({ title, description, variant: 'destructive' });
    },
  });
}

export function useDeleteShift() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('shifts').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts'] });
      toast({ title: 'Shift deleted' });
    },
    onError: (error: Error) => {
      const { title, description } = parseDbError(error, 'delete shift');
      toast({ title, description, variant: 'destructive' });
    },
  });
}
