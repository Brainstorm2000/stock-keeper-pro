import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { parseDbError } from '@/lib/db-errors';
import { customersTable, readLocalFirst } from '@/lib/offline/repository';
import { useMyBranchAssignments } from '@/hooks/useBranches';
import {
  findDuplicateCustomerContact,
  type CustomerContact,
} from '@/lib/customer-identity';

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

export class DuplicateCustomerContactError extends Error {
  constructor(field: 'email' | 'phone', customerName: string) {
    super(`A customer with this ${field} already exists: ${customerName}`);
    this.name = 'DuplicateCustomerContactError';
  }
}

function getDuplicateCustomerContactMessage(error: unknown) {
  if (error instanceof DuplicateCustomerContactError) return error.message;
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'object' &&
          error !== null &&
          'message' in error &&
          typeof error.message === 'string'
        ? error.message
        : null;
  if (!message) return null;
  return /a customer with this (email|phone(?: number)?) already exists/i.test(message)
    ? message
    : null;
}

export function isDuplicateCustomerContactError(error: unknown) {
  return getDuplicateCustomerContactMessage(error) !== null;
}

async function ensureUniqueCustomerContact(
  input: Pick<CustomerInput, 'branch_id' | 'email' | 'phone'>,
  organizationId: string,
  excludeId?: string,
) {
  const { data, error } = await supabase
    .from('customers')
    .select('id, name, branch_id, email, phone')
    .eq('organization_id', organizationId);

  if (error) throw error;

  const duplicate = findDuplicateCustomerContact(
    input,
    (data || []) as CustomerContact[],
    excludeId,
  );
  if (duplicate) {
    throw new DuplicateCustomerContactError(
      duplicate.field,
      duplicate.customer.name,
    );
  }
}

export function useCustomers() {
  const { organizationId, isSuperAdmin } = useAuth();
  const { data: branchAssignments = [], isLoading: assignmentsLoading } = useMyBranchAssignments();
  const accessibleBranchIds = isSuperAdmin
    ? []
    : branchAssignments.map((assignment) => assignment.branch_id).sort();

  return useQuery({
    queryKey: ['customers', organizationId, isSuperAdmin, accessibleBranchIds],
    enabled: !!organizationId && (isSuperAdmin || !assignmentsLoading),
    queryFn: async () => {
      return readLocalFirst(customersTable, async () => {
        const { data, error } = await supabase.from('customers').select('*').eq('organization_id', organizationId!).order('name');
        if (error) throw error;
        return data as Customer[];
      }, (customer) =>
        customer.organization_id === organizationId &&
        customer.branch_id !== null &&
        (isSuperAdmin || accessibleBranchIds.includes(customer.branch_id)),
      );
    },
  });
}

export function useCreateCustomer() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (customer: CustomerInput & { organization_id: string }) => {
      await ensureUniqueCustomerContact(customer, customer.organization_id);
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
      const duplicateMessage = getDuplicateCustomerContactMessage(error);
      if (duplicateMessage) {
        toast({
          title: 'Duplicate customer contact',
          description: duplicateMessage,
          variant: 'destructive',
        });
        return;
      }
      const { title, description } = parseDbError(error, 'create customer');
      toast({ title, description, variant: 'destructive' });
    },
  });
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...customer }: Partial<CustomerInput> & { id: string }) => {
      if (
        customer.branch_id !== undefined ||
        customer.email !== undefined ||
        customer.phone !== undefined
      ) {
        const { data: currentCustomer, error: currentCustomerError } = await supabase
          .from('customers')
          .select('organization_id, branch_id')
          .eq('id', id)
          .single();

        if (currentCustomerError) throw currentCustomerError;
        await ensureUniqueCustomerContact(
          {
            ...customer,
            branch_id:
              customer.branch_id !== undefined
                ? customer.branch_id
                : currentCustomer.branch_id,
          },
          currentCustomer.organization_id,
          id,
        );
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
      const duplicateMessage = getDuplicateCustomerContactMessage(error);
      if (duplicateMessage) {
        toast({
          title: 'Duplicate customer contact',
          description: duplicateMessage,
          variant: 'destructive',
        });
        return;
      }
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
      const organizationIds = [...new Set(customers.map((customer) => customer.organization_id))];
      if (organizationIds.length !== 1) {
        throw new Error('Customers in a bulk import must belong to one organization.');
      }

      const { data: existingCustomers, error: existingCustomersError } = await supabase
        .from('customers')
        .select('id, name, branch_id, email, phone')
        .eq('organization_id', organizationIds[0]);
      if (existingCustomersError) throw existingCustomersError;

      const knownCustomers = [...((existingCustomers || []) as CustomerContact[])];
      for (const [index, customer] of customers.entries()) {
        const duplicate = findDuplicateCustomerContact(customer, knownCustomers);
        if (duplicate) {
          throw new DuplicateCustomerContactError(
            duplicate.field,
            duplicate.customer.name,
          );
        }
        knownCustomers.push({
          id: `pending-${index}`,
          name: customer.name,
          branch_id: customer.branch_id ?? null,
          email: customer.email ?? null,
          phone: customer.phone ?? null,
        });
      }

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
      const duplicateMessage = getDuplicateCustomerContactMessage(error);
      if (duplicateMessage) {
        toast({
          title: 'Duplicate customer contact',
          description: duplicateMessage,
          variant: 'destructive',
        });
        return;
      }
      const { title, description } = parseDbError(error, 'import customers');
      toast({ title, description, variant: 'destructive' });
    },
  });
}
