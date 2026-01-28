import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';

export interface Branch {
  id: string;
  name: string;
  address: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface BranchInput {
  name: string;
  address?: string;
}

export interface UserBranchAssignment {
  id: string;
  user_id: string;
  branch_id: string;
  created_at: string;
}

export function useBranches() {
  return useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('branches')
        .select('*')
        .order('name');

      if (error) throw error;
      return data as Branch[];
    },
  });
}

export function useUserBranchAssignments(userId?: string) {
  return useQuery({
    queryKey: ['user-branch-assignments', userId],
    queryFn: async () => {
      if (!userId) return [];
      
      const { data, error } = await supabase
        .from('user_branch_assignments')
        .select('*')
        .eq('user_id', userId);

      if (error) throw error;
      return data as UserBranchAssignment[];
    },
    enabled: !!userId,
  });
}

export function useCreateBranch() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (branch: BranchInput) => {
      const { data, error } = await supabase
        .from('branches')
        .insert({
          ...branch,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      toast({ title: 'Branch created successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to create branch', description: error.message, variant: 'destructive' });
    },
  });
}

export function useUpdateBranch() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...branch }: BranchInput & { id: string }) => {
      const { data, error } = await supabase
        .from('branches')
        .update(branch)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      toast({ title: 'Branch updated successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update branch', description: error.message, variant: 'destructive' });
    },
  });
}

export function useDeleteBranch() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('branches').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      toast({ title: 'Branch deleted successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to delete branch', description: error.message, variant: 'destructive' });
    },
  });
}

export function useAssignUserToBranch() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ userId, branchId }: { userId: string; branchId: string }) => {
      const { data, error } = await supabase
        .from('user_branch_assignments')
        .insert({
          user_id: userId,
          branch_id: branchId,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-branch-assignments'] });
      toast({ title: 'User assigned to branch successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to assign user to branch', description: error.message, variant: 'destructive' });
    },
  });
}

export function useRemoveUserFromBranch() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ userId, branchId }: { userId: string; branchId: string }) => {
      const { error } = await supabase
        .from('user_branch_assignments')
        .delete()
        .eq('user_id', userId)
        .eq('branch_id', branchId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-branch-assignments'] });
      toast({ title: 'User removed from branch successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to remove user from branch', description: error.message, variant: 'destructive' });
    },
  });
}
