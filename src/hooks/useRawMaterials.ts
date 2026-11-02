import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { parseDbError } from '@/lib/db-errors';

export interface RawMaterial {
  id: string;
  organization_id: string;
  name: string;
  unit_id: string;
  cost_per_unit: number;
  current_stock: number;
  low_stock_threshold: number;
  sku: string | null;
  description: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  units?: { id: string; name: string; abbreviation: string | null };
}

export interface RawMaterialInput {
  name: string;
  unit_id: string;
  cost_per_unit: number;
  current_stock: number;
  low_stock_threshold?: number;
  sku?: string;
  description?: string;
}

export function useRawMaterials() {
  return useQuery({
    queryKey: ['raw-materials'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('raw_materials')
        .select('*, units (id, name, abbreviation)')
        .order('name');
      if (error) throw error;
      return data as RawMaterial[];
    },
  });
}

export function useCreateRawMaterial() {
  const queryClient = useQueryClient();
  const { user, organizationId } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: RawMaterialInput) => {
      if (!organizationId) throw new Error('No organization');
      const { data, error } = await supabase
        .from('raw_materials')
        .insert({
          ...input,
          organization_id: organizationId,
          created_by: user?.id,
        })
        .select()
        .single();
      if (error) throw error;

      // Log initial stock
      if (input.current_stock > 0) {
        await supabase.from('raw_material_stock_history').insert({
          raw_material_id: data.id,
          previous_stock: 0,
          new_stock: input.current_stock,
          change_amount: input.current_stock,
          change_type: 'initial',
          notes: 'Initial stock entry',
          changed_by: user?.id,
        });
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['raw-materials'] });
      toast({ title: 'Raw material created' });
    },
    onError: (error: Error) => {
      const { title, description } = parseDbError(error, 'create raw material');
      toast({ title, description, variant: 'destructive' });
    },
  });
}

export function useUpdateRawMaterial() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, ...input }: RawMaterialInput & { id: string }) => {
      const { data: existing, error: existingError } = await supabase
        .from('raw_materials')
        .select('current_stock')
        .eq('id', id)
        .single();
      if (existingError) throw existingError;

      const metadata = { ...input };
      delete metadata.current_stock;
      const { data, error } = await supabase
        .from('raw_materials')
        .update(metadata)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;

      const stockChange = Number(input.current_stock) - Number(existing.current_stock);
      if (stockChange !== 0) {
        const { error: adjustmentError } = await supabase.rpc('adjust_raw_material_batch_stock', {
          _raw_material_id: id,
          _change_amount: stockChange,
          _notes: 'Stock adjusted while editing raw material',
        });
        if (adjustmentError) throw adjustmentError;
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['raw-materials'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-batches'] });
      toast({ title: 'Raw material updated' });
    },
    onError: (error: Error) => {
      const { title, description } = parseDbError(error, 'update raw material');
      toast({ title, description, variant: 'destructive' });
    },
  });
}

export function useDeleteRawMaterial() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('raw_materials').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['raw-materials'] });
      toast({ title: 'Raw material deleted' });
    },
    onError: (error: Error) => {
      const { title, description } = parseDbError(error, 'Raw Material');
      toast({ title, description, variant: 'destructive' });
    },
  });
}

export function useUpdateRawMaterialStock() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      materialId,
      currentStock,
      newStock,
      notes,
      batchNumber,
      expirationDate,
    }: {
      materialId: string;
      currentStock: number;
      newStock: number;
      notes?: string;
      batchNumber?: string;
      expirationDate?: string | null;
    }) => {
      const { error } = await supabase.rpc('adjust_raw_material_batch_stock', {
        _raw_material_id: materialId,
        _change_amount: newStock - currentStock,
        _batch_number: batchNumber?.trim() || null,
        _expiration_date: expirationDate || null,
        _notes: notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['raw-materials'] });
      queryClient.invalidateQueries({ queryKey: ['raw-material-stock-history'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-batches'] });
      toast({ title: 'Stock updated' });
    },
    onError: (error: Error) => {
      const { title, description } = parseDbError(error, 'update stock');
      toast({ title, description, variant: 'destructive' });
    },
  });
}
