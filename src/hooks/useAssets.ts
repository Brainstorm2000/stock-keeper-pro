import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { parseDbError } from '@/lib/db-errors';

export const ASSET_STATUSES = ['In Use', 'In Storage', 'Under Maintenance', 'Written Off', 'Disposed'] as const;

export interface Asset {
  id: string;
  organization_id: string;
  tag_id: string;
  name: string;
  category: string;
  category_id: string | null;
  status: (typeof ASSET_STATUSES)[number];
  custodian_id: string | null;
  branch_id: string | null;
  purchase_cost: number;
  purchase_date: string | null;
  maintenance_required: boolean;
  created_at: string;
  updated_at: string;
  staff?: { id: string; full_name: string } | null;
  branches?: { id: string; name: string } | null;
  asset_categories?: { id: string; name: string } | null;
}

export type AssetCategory = { id: string; organization_id: string; name: string; created_at: string; updated_at: string; created_by: string | null };
export type AssetInput = Omit<Asset, 'id' | 'organization_id' | 'created_at' | 'updated_at' | 'staff' | 'branches' | 'asset_categories'>;

export function useAssetCategories() {
  return useQuery({
    queryKey: ['asset-categories'],
    queryFn: async () => {
      const { data, error } = await supabase.from('asset_categories').select('*').order('name');
      if (error) throw error;
      return data as AssetCategory[];
    },
  });
}

export function useCreateAssetCategory() {
  const queryClient = useQueryClient();
  const { user, organizationId } = useAuth();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (name: string) => {
      if (!organizationId) throw new Error('No organization found');
      const { data, error } = await supabase.from('asset_categories').insert({ name, organization_id: organizationId, created_by: user?.id }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['asset-categories'] }); toast({ title: 'Asset category created' }); },
    onError: (error: Error) => { const { title, description } = parseDbError(error, 'create asset category'); toast({ title, description, variant: 'destructive' }); },
  });
}

export function useUpdateAssetCategory() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { data, error } = await supabase.from('asset_categories').update({ name }).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['asset-categories'] }); queryClient.invalidateQueries({ queryKey: ['assets'] }); toast({ title: 'Asset category updated' }); },
    onError: (error: Error) => { const { title, description } = parseDbError(error, 'update asset category'); toast({ title, description, variant: 'destructive' }); },
  });
}

export function useDeleteAssetCategory() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('asset_categories').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['asset-categories'] }); queryClient.invalidateQueries({ queryKey: ['assets'] }); toast({ title: 'Asset category deleted' }); },
    onError: (error: Error) => { const { title, description } = parseDbError(error, 'delete asset category'); toast({ title, description, variant: 'destructive' }); },
  });
}

export function useAssets() {
  return useQuery({
    queryKey: ['assets'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('assets')
        .select('*, staff(id, full_name), branches(id, name), asset_categories(id, name)')
        .order('name');
      if (error) throw error;
      return data as Asset[];
    },
  });
}

export function useCreateAsset() {
  const queryClient = useQueryClient();
  const { user, organizationId } = useAuth();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (input: AssetInput) => {
      if (!organizationId) throw new Error('No organization found');
      const { data, error } = await supabase
        .from('assets')
        .insert({ ...input, organization_id: organizationId, created_by: user?.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      toast({ title: 'Asset added' });
    },
    onError: (error: Error) => {
      const { title, description } = parseDbError(error, 'add asset');
      toast({ title, description, variant: 'destructive' });
    },
  });
}

export function useUpdateAsset() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, ...input }: AssetInput & { id: string }) => {
      const { data, error } = await supabase.from('assets').update(input).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      toast({ title: 'Asset updated' });
    },
    onError: (error: Error) => {
      const { title, description } = parseDbError(error, 'update asset');
      toast({ title, description, variant: 'destructive' });
    },
  });
}

export function useDeleteAsset() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('assets').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      toast({ title: 'Asset deleted' });
    },
    onError: (error: Error) => {
      const { title, description } = parseDbError(error, 'delete asset');
      toast({ title, description, variant: 'destructive' });
    },
  });
}
