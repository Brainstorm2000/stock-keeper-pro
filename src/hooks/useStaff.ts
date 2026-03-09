import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { parseDbError } from '@/lib/db-errors';

export interface Staff {
  id: string;
  organization_id: string;
  staff_id: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: string | null;
  department: string | null;
  branch_id: string | null;
  employment_date: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
  branches?: { id: string; name: string } | null;
}

export interface StaffInput {
  staff_id?: string | null;
  full_name: string;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
  department?: string | null;
  branch_id?: string | null;
  employment_date?: string | null;
  is_active?: boolean;
  notes?: string | null;
}

function sanitizeStaffInput(input: StaffInput) {
  return {
    ...input,
    staff_id: input.staff_id || null,
    email: input.email || null,
    phone: input.phone || null,
    role: input.role || null,
    department: input.department || null,
    branch_id: input.branch_id || null,
    employment_date: input.employment_date || null,
    notes: input.notes || null,
  };
}

export function useStaff() {
  return useQuery({
    queryKey: ['staff'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('staff')
        .select('*, branches(id, name)')
        .order('full_name');
      if (error) throw error;
      return data as Staff[];
    },
  });
}

export function useCreateStaff() {
  const queryClient = useQueryClient();
  const { user, organizationId } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: StaffInput) => {
      if (!organizationId) throw new Error('No organization');
      const sanitized = sanitizeStaffInput(input);
      const { data, error } = await supabase
        .from('staff')
        .insert({ ...sanitized, organization_id: organizationId, created_by: user?.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      toast({ title: 'Staff member created' });
    },
    onError: (error: Error) => {
      const { title, description } = parseDbError(error, 'create staff');
      toast({ title, description, variant: 'destructive' });
    },
  });
}

export function useUpdateStaff() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...input }: StaffInput & { id: string }) => {
      const sanitized = sanitizeStaffInput(input);
      const { data, error } = await supabase
        .from('staff')
        .update(sanitized)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      toast({ title: 'Staff member updated' });
    },
    onError: (error: Error) => {
      const { title, description } = parseDbError(error, 'update staff');
      toast({ title, description, variant: 'destructive' });
    },
  });
}

export function useDeleteStaff() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('staff').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      toast({ title: 'Staff member deleted' });
    },
    onError: (error: Error) => {
      const { title, description } = parseDbError(error, 'Staff');
      toast({ title, description, variant: 'destructive' });
    },
  });
}
