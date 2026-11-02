import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { parseDbError } from '@/lib/db-errors';

export interface DamageRecord {
  id: string;
  product_id: string;
  previous_stock: number;
  new_stock: number;
  change_amount: number;
  change_type: string;
  notes: string | null;
  changed_by: string | null;
  created_at: string;
  products?: { id: string; name: string; current_stock: number; cost_price: number; branch_id?: string | null; item_type?: string };
  changed_by_user?: { full_name: string | null; email: string | null } | null;
}

export interface WasteRecord {
  id: string;
  raw_material_id: string;
  previous_stock: number;
  new_stock: number;
  change_amount: number;
  change_type: string;
  notes: string | null;
  changed_by: string | null;
  created_at: string;
  raw_materials?: { id: string; name: string; current_stock: number; cost_per_unit: number };
  changed_by_user?: { full_name: string | null; email: string | null } | null;
}

async function fetchProfiles(userIds: string[]) {
  if (userIds.length === 0) return {};
  const { data: profiles } = await supabase
    .rpc('get_org_user_names', { _user_ids: userIds });
  if (!profiles) return {};
  return (profiles as Array<{ user_id: string; full_name: string | null; email: string | null }>).reduce((acc, p) => {
    acc[p.user_id] = { full_name: p.full_name, email: p.email };
    return acc;
  }, {} as Record<string, { full_name: string | null; email: string | null }>);
}

export function useDamageHistory() {
  return useQuery({
    queryKey: ['damage-history'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stock_history')
        .select('*, products (id, name, current_stock, cost_price, branch_id, item_type)')
        .in('change_type', ['damage', 'damaged'])
        .order('created_at', { ascending: false });
      if (error) throw error;

      const userIds = [...new Set(data?.map(d => d.changed_by).filter(Boolean) as string[])];
      const profilesMap = await fetchProfiles(userIds);

      return data
        .filter(entry => (entry as any).products?.item_type !== 'service')
        .map(entry => ({
        ...entry,
        changed_by_user: entry.changed_by ? profilesMap[entry.changed_by] || null : null,
      })) as DamageRecord[];
    },
  });
}

export function useWasteHistory() {
  return useQuery({
    queryKey: ['waste-history'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('raw_material_stock_history')
        .select('*, raw_materials (id, name, current_stock, cost_per_unit)')
        .eq('change_type', 'waste')
        .order('created_at', { ascending: false });
      if (error) throw error;

      const userIds = [...new Set(data?.map(d => d.changed_by).filter(Boolean) as string[])];
      const profilesMap = await fetchProfiles(userIds);

      return data.map(entry => ({
        ...entry,
        changed_by_user: entry.changed_by ? profilesMap[entry.changed_by] || null : null,
      })) as WasteRecord[];
    },
  });
}

export function useEditDamage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ recordId, productId, oldChangeAmount, newQuantity, notes }: {
      recordId: string; productId: string; oldChangeAmount: number; newQuantity: number; notes?: string;
    }) => {
      // oldChangeAmount is negative (e.g. -5), newQuantity is positive (e.g. 3)
      const diff = Math.abs(oldChangeAmount) - newQuantity; // positive = less damage now, negative = more damage

      if (diff !== 0) {
        const { error: adjustmentError } = await supabase.rpc('adjust_product_batch_stock', {
          _product_id: productId,
          _change_amount: diff,
          _notes: notes || 'Damage record adjusted',
          _change_type: 'damage_adjustment',
        });
        if (adjustmentError) throw adjustmentError;
      }

      const { data: record, error: recordError } = await supabase
        .from('stock_history')
        .select('previous_stock')
        .eq('id', recordId)
        .single();
      if (recordError) throw recordError;
      const prevStock = Number(record.previous_stock);

      const { error } = await supabase.from('stock_history').update({
        change_amount: -newQuantity,
        new_stock: prevStock - newQuantity,
        notes: notes || null,
      }).eq('id', recordId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['damage-history'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['stock-history'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-batches'] });
      toast({ title: 'Damage record updated' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update', description: error.message, variant: 'destructive' });
    },
  });
}

export function useDeleteDamage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ recordId, productId, changeAmount }: {
      recordId: string; productId: string; changeAmount: number;
    }) => {
      const { error: adjustmentError } = await supabase.rpc('adjust_product_batch_stock', {
        _product_id: productId,
        _change_amount: Math.abs(changeAmount),
        _notes: 'Damage record reversed',
        _change_type: 'damage_reversal',
      });
      if (adjustmentError) throw adjustmentError;

      const { error } = await supabase.from('stock_history').delete().eq('id', recordId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['damage-history'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['stock-history'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-batches'] });
      toast({ title: 'Damage record deleted, stock restored' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to delete', description: error.message, variant: 'destructive' });
    },
  });
}

export function useEditWaste() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ recordId, materialId, oldChangeAmount, newQuantity, notes }: {
      recordId: string; materialId: string; oldChangeAmount: number; newQuantity: number; notes?: string;
    }) => {
      const diff = Math.abs(oldChangeAmount) - newQuantity;

      if (diff !== 0) {
        const { error: adjustmentError } = await supabase.rpc('adjust_raw_material_batch_stock', {
          _raw_material_id: materialId,
          _change_amount: diff,
          _notes: notes || 'Waste record adjusted',
          _change_type: 'waste_adjustment',
        });
        if (adjustmentError) throw adjustmentError;
      }

      const { data: record, error: recordError } = await supabase
        .from('raw_material_stock_history')
        .select('previous_stock')
        .eq('id', recordId)
        .single();
      if (recordError) throw recordError;
      const prevStock = Number(record.previous_stock);

      const { error } = await supabase.from('raw_material_stock_history').update({
        change_amount: -newQuantity,
        new_stock: prevStock - newQuantity,
        notes: notes || null,
      }).eq('id', recordId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waste-history'] });
      queryClient.invalidateQueries({ queryKey: ['raw-materials'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-batches'] });
      toast({ title: 'Waste record updated' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to update', description: error.message, variant: 'destructive' });
    },
  });
}

export function useDeleteWaste() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ recordId, materialId, changeAmount }: {
      recordId: string; materialId: string; changeAmount: number;
    }) => {
      const { error: adjustmentError } = await supabase.rpc('adjust_raw_material_batch_stock', {
        _raw_material_id: materialId,
        _change_amount: Math.abs(changeAmount),
        _notes: 'Waste record reversed',
        _change_type: 'waste_reversal',
      });
      if (adjustmentError) throw adjustmentError;

      const { error } = await supabase.from('raw_material_stock_history').delete().eq('id', recordId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waste-history'] });
      queryClient.invalidateQueries({ queryKey: ['raw-materials'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-batches'] });
      toast({ title: 'Waste record deleted, stock restored' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to delete', description: error.message, variant: 'destructive' });
    },
  });
}
