import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { parseDbError } from '@/lib/db-errors';

export interface ActionTask {
  id: string;
  organization_id: string;
  staff_id: string;
  branch_id: string | null;
  title: string;
  description: string | null;
  start_date: string | null;
  due_date: string | null;
  completion_date: string | null;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'in_progress' | 'completed';
  created_by: string | null;
  created_at: string;
  updated_at: string;
  staff?: { id: string; full_name: string } | null;
  branches?: { id: string; name: string } | null;
}

export interface ActionTaskInput {
  staff_id: string;
  branch_id?: string | null;
  title: string;
  description?: string | null;
  start_date?: string | null;
  due_date?: string | null;
  priority?: 'low' | 'medium' | 'high';
  status?: 'pending' | 'in_progress' | 'completed';
}

export function useActionTasks() {
  return useQuery({
    queryKey: ['action-tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('action_tasks')
        .select('*, staff(id, full_name), branches(id, name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as ActionTask[];
    },
  });
}

export function useStaffTasks(staffId: string) {
  return useQuery({
    queryKey: ['action-tasks', 'staff', staffId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('action_tasks')
        .select('*, staff(id, full_name), branches(id, name)')
        .eq('staff_id', staffId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as ActionTask[];
    },
    enabled: !!staffId,
  });
}

export function useCreateActionTask() {
  const queryClient = useQueryClient();
  const { user, organizationId } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: ActionTaskInput) => {
      if (!organizationId) throw new Error('No organization');
      const { data, error } = await supabase
        .from('action_tasks')
        .insert({ ...input, organization_id: organizationId, created_by: user?.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['action-tasks'] });
      toast({ title: 'Task created' });
    },
    onError: (error: Error) => {
      const { title, description } = parseDbError(error, 'create task');
      toast({ title, description, variant: 'destructive' });
    },
  });
}

export function useUpdateActionTask() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...input }: Partial<ActionTaskInput> & { id: string; completion_date?: string | null }) => {
      const { data, error } = await supabase
        .from('action_tasks')
        .update(input)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['action-tasks'] });
      toast({ title: 'Task updated' });
    },
    onError: (error: Error) => {
      const { title, description } = parseDbError(error, 'update task');
      toast({ title, description, variant: 'destructive' });
    },
  });
}

export function useDeleteActionTask() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('action_tasks').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['action-tasks'] });
      toast({ title: 'Task deleted' });
    },
    onError: (error: Error) => {
      const { title, description } = parseDbError(error, 'Task');
      toast({ title, description, variant: 'destructive' });
    },
  });
}
