import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { parseDbError } from '@/lib/db-errors';
import { customersTable, readLocalFirst, saveLocal, removeLocal } from '@/lib/offline/repository';

export interface Customer {
  id: string;
  organization_id: string;
  branch_id: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  debt_limit: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerInput {
  branch_id?: string | null;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
  debt_limit?: number;
}

export function useCustomers() {
  const { organizationId } = useAuth();
  return useQuery({
    queryKey: ['customers', organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      return readLocalFirst(customersTable, async () => {
        const { data, error } = await supabase.from('customers').select('*').eq('organization_id', organizationId!).order('name');
        if (error) throw error;
        return data as Customer[];
      }, (customer) => customer.organization_id === organizationId);
    },
  });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (customer: CustomerInput & { organization_id: string }) => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        const now = new Date().toISOString();
        return saveLocal(customersTable, {
          ...customer,
          id: crypto.randomUUID(),
          created_by: user?.id ?? null,
          created_at: now,
          updated_at: now,
          email: customer.email ?? null,
          phone: customer.phone ?? null,
          address: customer.address ?? null,
          notes: customer.notes ?? null,
          debt_limit: customer.debt_limit ?? 0,
        });
      }
      const { data, error } = await supabase
        .from('customers')
        .insert({
          ...customer,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast({ title: 'Customer created successfully' });
    },
    onError: (error: Error) => {
      const { title, description } = parseDbError(error, 'create customer');
      toast({ title, description, variant: 'destructive' });
    },
  });
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...customer }: CustomerInput & { id: string }) => {
      const existing = await customersTable.get(id);
      if (typeof navigator !== 'undefined' && !navigator.onLine && existing) {
        return saveLocal(customersTable, { ...existing.data, ...customer, id } as Customer);
      }
      const { data, error } = await supabase
        .from('customers')
        .update(customer)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast({ title: 'Customer updated successfully' });
    },
    onError: (error: Error) => {
      const { title, description } = parseDbError(error, 'update customer');
      toast({ title, description, variant: 'destructive' });
    },
  });
}

export function useDeleteCustomer() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        await removeLocal(customersTable, id);
        return;
      }
      const { error } = await supabase.from('customers').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast({ title: 'Customer deleted successfully' });
    },
    onError: (error: Error) => {
      const { title, description } = parseDbError(error, 'Customer');
      toast({ title, description, variant: 'destructive' });
    },
  });
}

export function useBulkCreateCustomers() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (customers: (CustomerInput & { organization_id: string })[]) => {
      const { data, error } = await supabase
        .from('customers')
        .insert(customers.map(c => ({ ...c, created_by: user?.id })))
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      toast({ title: `${data.length} customers imported successfully` });
    },
    onError: (error: Error) => {
      const { title, description } = parseDbError(error, 'import customers');
      toast({ title, description, variant: 'destructive' });
    },
  });
}
