import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { parseDbError } from '@/lib/db-errors';

export interface Branch {
  id: string;
  name: string;
  address: string | null;
  organization_id: string | null;
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

// Hook to check if the current user has any branch assignments
export function useMyBranchAssignments() {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ['my-branch-assignments', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      
      const { data, error } = await supabase
        .from('user_branch_assignments')
        .select('*')
        .eq('user_id', user.id);

      if (error) throw error;
      return data as UserBranchAssignment[];
    },
    enabled: !!user?.id,
  });
}

// Returns the default branch id for the current user:
// - first assigned branch if any
// - else the only branch in the org if there is exactly one
export function useDefaultBranchId(): string | undefined {
  const { data: assignments = [] } = useMyBranchAssignments();
  const { data: branches = [] } = useBranches();
  if (assignments.length > 0) return assignments[0].branch_id;
  if (branches.length === 1) return branches[0].id;
  return undefined;
}

export function useCreateBranch() {
  const queryClient = useQueryClient();
  const { user, organizationId } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (branch: BranchInput) => {
      if (!organizationId) throw new Error('No organization found');

      // Check subscription branch limit
      const [{ data: sub }, { count: branchCount }] = await Promise.all([
        supabase
          .from('organization_subscriptions')
          .select('number_of_branches')
          .eq('organization_id', organizationId)
          .maybeSingle(),
        supabase
          .from('branches')
          .select('*', { count: 'exact', head: true })
          .eq('organization_id', organizationId),
      ]);

      if (sub && branchCount !== null && branchCount >= sub.number_of_branches) {
        throw new Error('You have reached the maximum number of branches allowed by your subscription plan.');
      }

      const { data, error } = await supabase
        .from('branches')
        .insert({
          ...branch,
          created_by: user?.id,
          organization_id: organizationId,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505' && error.message?.includes('idx_branches_unique_name_per_org')) {
          throw new Error('A branch with this name already exists in this organization.');
        }
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      toast({ title: 'Branch created successfully' });
    },
    onError: (error: Error) => {
      const { title, description } = parseDbError(error, 'create branch');
      toast({ title, description, variant: 'destructive' });
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

      if (error) {
        if (error.code === '23505' && error.message?.includes('idx_branches_unique_name_per_org')) {
          throw new Error('A branch with this name already exists in this organization.');
        }
        throw error;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      toast({ title: 'Branch updated successfully' });
    },
    onError: (error: Error) => {
      const { title, description } = parseDbError(error, 'update branch');
      toast({ title, description, variant: 'destructive' });
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
      const { title, description } = parseDbError(error, 'Branch');
      toast({ title, description, variant: 'destructive' });
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
      const { title, description } = parseDbError(error, 'assign user to branch');
      toast({ title, description, variant: 'destructive' });
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
      const { title, description } = parseDbError(error, 'remove user from branch');
      toast({ title, description, variant: 'destructive' });
    },
  });
}
