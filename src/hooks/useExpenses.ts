import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { parseDbError } from '@/lib/db-errors';

export interface ExpenseCategory {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Expense {
  id: string;
  organization_id: string;
  branch_id: string | null;
  category_id: string | null;
  amount: number;
  description: string;
  expense_date: string;
  receipt_url: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  expense_categories?: ExpenseCategory;
  branches?: { id: string; name: string };
}

export interface ExpenseInput {
  organization_id: string;
  branch_id?: string;
  category_id?: string;
  amount: number;
  description: string;
  expense_date: string;
  receipt_url?: string;
  notes?: string;
}

export function useExpenseCategories() {
  return useQuery({
    queryKey: ['expense-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expense_categories')
        .select('*')
        .order('name');

      if (error) throw error;
      return data as ExpenseCategory[];
    },
  });
}

export function useCreateExpenseCategory() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: { organization_id: string; name: string; description?: string }) => {
      const { data, error } = await supabase
        .from('expense_categories')
        .insert({
          organization_id: input.organization_id,
          name: input.name,
          description: input.description || null,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense-categories'] });
      toast({ title: 'Category created successfully' });
    },
    onError: (error: Error) => {
      const { title, description } = parseDbError(error, 'create category');
      toast({ title, description, variant: 'destructive' });
    },
  });
}

export function useDeleteExpenseCategory() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('expense_categories')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense-categories'] });
      toast({ title: 'Category deleted successfully' });
    },
    onError: (error: Error) => {
      const { title, description } = parseDbError(error, 'delete category');
      toast({ title, description, variant: 'destructive' });
    },
  });
}

export function useExpenses() {
  return useQuery({
    queryKey: ['expenses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('expenses')
        .select(`
          *,
          expense_categories (id, name),
          branches (id, name)
        `)
        .order('expense_date', { ascending: false });

      if (error) throw error;
      return data as Expense[];
    },
  });
}

export function useCreateExpense() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: ExpenseInput) => {
      const { data, error } = await supabase
        .from('expenses')
        .insert({
          organization_id: input.organization_id,
          branch_id: input.branch_id || null,
          category_id: input.category_id || null,
          amount: input.amount,
          description: input.description,
          expense_date: input.expense_date,
          receipt_url: input.receipt_url || null,
          notes: input.notes || null,
          created_by: user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast({ title: 'Expense recorded successfully' });
    },
    onError: (error: Error) => {
      const { title, description } = parseDbError(error, 'create expense');
      toast({ title, description, variant: 'destructive' });
    },
  });
}

export function useUpdateExpense() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...input }: ExpenseInput & { id: string }) => {
      const { data, error } = await supabase
        .from('expenses')
        .update({
          branch_id: input.branch_id || null,
          category_id: input.category_id || null,
          amount: input.amount,
          description: input.description,
          expense_date: input.expense_date,
          receipt_url: input.receipt_url || null,
          notes: input.notes || null,
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast({ title: 'Expense updated successfully' });
    },
    onError: (error: Error) => {
      const { title, description } = parseDbError(error, 'update expense');
      toast({ title, description, variant: 'destructive' });
    },
  });
}

export function useDeleteExpense() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('expenses')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      toast({ title: 'Expense deleted successfully' });
    },
    onError: (error: Error) => {
      const { title, description } = parseDbError(error, 'delete expense');
      toast({ title, description, variant: 'destructive' });
    },
  });
}

export async function uploadExpenseReceipt(file: File, organizationId: string): Promise<string> {
  const fileExt = file.name.split('.').pop();
  const fileName = `${organizationId}/${crypto.randomUUID()}.${fileExt}`;

  const { error: uploadError } = await supabase.storage
    .from('expense-receipts')
    .upload(fileName, file);

  if (uploadError) throw uploadError;

  // Bucket is private — store the storage path; generate signed URLs for viewing.
  return fileName;
}

/**
 * Resolve a stored receipt reference to a viewable URL.
 * Accepts either a storage path (preferred, private bucket) or a legacy public URL.
 */
export async function getExpenseReceiptUrl(receiptRef: string): Promise<string> {
  // Legacy values may already be full URLs — return as-is.
  if (/^https?:\/\//i.test(receiptRef)) return receiptRef;

  const { data, error } = await supabase.storage
    .from('expense-receipts')
    .createSignedUrl(receiptRef, 60 * 10); // 10 minutes

  if (error || !data?.signedUrl) {
    throw error ?? new Error('Could not generate receipt URL');
  }
  return data.signedUrl;
}
