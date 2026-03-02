import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/hooks/useOrganization';
import { useToast } from '@/hooks/use-toast';

export interface ProductionTable {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductionField {
  id: string;
  table_id: string;
  name: string;
  type: 'text' | 'number' | 'currency' | 'date' | 'boolean' | 'select';
  required: boolean;
  options: string[];
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ProductionRecord {
  id: string;
  table_id: string;
  created_by: string | null;
  created_at: string;
}

export interface ProductionRecordValue {
  id: string;
  record_id: string;
  field_id: string;
  value: string | null;
}

// Fetch all production tables for the organization
export function useProductionTables() {
  const { data: organization } = useOrganization();

  return useQuery({
    queryKey: ['production-tables', organization?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('production_tables')
        .select('*')
        .eq('organization_id', organization!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as ProductionTable[];
    },
    enabled: !!organization?.id,
  });
}

// Fetch fields for a specific table
export function useProductionFields(tableId: string | null) {
  return useQuery({
    queryKey: ['production-fields', tableId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('production_fields')
        .select('*')
        .eq('table_id', tableId!)
        .order('sort_order');
      if (error) throw error;
      return (data as any[]).map(f => ({
        ...f,
        options: Array.isArray(f.options) ? f.options : [],
      })) as ProductionField[];
    },
    enabled: !!tableId,
  });
}

// Fetch records + values for a table
export function useProductionRecords(tableId: string | null) {
  return useQuery({
    queryKey: ['production-records', tableId],
    queryFn: async () => {
      const { data: records, error: recErr } = await supabase
        .from('production_records')
        .select('*')
        .eq('table_id', tableId!)
        .order('created_at', { ascending: false });
      if (recErr) throw recErr;

      if (!records || records.length === 0) return [];

      const recordIds = records.map(r => r.id);
      const { data: values, error: valErr } = await supabase
        .from('production_record_values')
        .select('*')
        .in('record_id', recordIds);
      if (valErr) throw valErr;

      // Map values to records
      return records.map(rec => ({
        ...rec,
        values: (values || []).filter(v => v.record_id === rec.id) as ProductionRecordValue[],
      }));
    },
    enabled: !!tableId,
  });
}

// CRUD mutations
export function useCreateProductionTable() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (data: { organization_id: string; name: string; description?: string }) => {
      const { data: result, error } = await supabase
        .from('production_tables')
        .insert(data)
        .select()
        .single();
      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['production-tables'] });
      toast({ title: 'Table created' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });
}

export function useUpdateProductionTable() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name?: string; description?: string }) => {
      const { error } = await supabase.from('production_tables').update(data).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['production-tables'] });
      toast({ title: 'Table updated' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });
}

export function useDeleteProductionTable() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('production_tables').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['production-tables'] });
      toast({ title: 'Table deleted' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });
}

export function useCreateProductionField() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (data: { table_id: string; name: string; type: string; required?: boolean; options?: string[]; sort_order?: number }) => {
      const { error } = await supabase.from('production_fields').insert(data);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['production-fields', vars.table_id] });
      toast({ title: 'Field added' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });
}

export function useUpdateProductionField() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, tableId, ...data }: { id: string; tableId: string; name?: string; type?: string; required?: boolean; options?: string[] }) => {
      const { error } = await supabase.from('production_fields').update(data).eq('id', id);
      if (error) throw error;
      return tableId;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['production-fields', vars.tableId] });
      toast({ title: 'Field updated' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });
}

export function useDeleteProductionField() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, tableId }: { id: string; tableId: string }) => {
      const { error } = await supabase.from('production_fields').delete().eq('id', id);
      if (error) throw error;
      return tableId;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['production-fields', vars.tableId] });
      qc.invalidateQueries({ queryKey: ['production-records', vars.tableId] });
      toast({ title: 'Field deleted' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });
}

export function useCreateProductionRecord() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ tableId, values }: { tableId: string; values: { field_id: string; value: string | null }[] }) => {
      const { data: record, error: recErr } = await supabase
        .from('production_records')
        .insert({ table_id: tableId })
        .select()
        .single();
      if (recErr) throw recErr;

      if (values.length > 0) {
        const { error: valErr } = await supabase
          .from('production_record_values')
          .insert(values.map(v => ({ record_id: record.id, ...v })));
        if (valErr) throw valErr;
      }
      return record;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['production-records', vars.tableId] });
      toast({ title: 'Record added' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });
}

export function useDeleteProductionRecord() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, tableId }: { id: string; tableId: string }) => {
      const { error } = await supabase.from('production_records').delete().eq('id', id);
      if (error) throw error;
      return tableId;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['production-records', vars.tableId] });
      toast({ title: 'Record deleted' });
    },
    onError: (e: any) => toast({ title: 'Error', description: e.message, variant: 'destructive' }),
  });
}
