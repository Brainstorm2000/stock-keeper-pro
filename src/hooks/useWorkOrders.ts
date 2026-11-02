import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { parseDbError } from '@/lib/db-errors';

export type WorkOrderStatus = 'draft' | 'approved' | 'in_progress' | 'completed' | 'cancelled';

export interface WorkOrderMaterial {
  id: string;
  work_order_id: string;
  raw_material_id: string;
  quantity_required: number;
  quantity_used: number;
  unit_cost: number;
  total_cost: number;
  raw_materials?: {
    id: string;
    name: string;
    current_stock: number;
    cost_per_unit: number;
  };
  consumed_batches?: { batch_number: string; quantity: number }[];
}

export interface WorkOrder {
  id: string;
  organization_id: string;
  branch_id: string | null;
  work_order_number: string;
  product_id: string;
  bom_id: string;
  quantity: number;
  status: WorkOrderStatus;
  labor_cost: number;
  overhead_cost: number;
  material_cost: number;
  total_cost: number;
  cost_per_unit: number;
  notes: string | null;
  approved_at: string | null;
  completed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  products?: { id: string; name: string; selling_price: number };
  bill_of_materials?: { id: string; name: string; labor_cost_per_unit: number; overhead_cost_per_unit: number };
  work_order_materials?: WorkOrderMaterial[];
  branches?: { id: string; name: string } | null;
  created_by_user?: { full_name: string | null; email: string | null } | null;
}

export interface WorkOrderInput {
  product_id: string;
  bom_id: string;
  quantity: number;
  labor_cost?: number;
  overhead_cost?: number;
  notes?: string;
  branch_id?: string;
}

const requireAuthenticatedUserId = (userId: string | undefined) => {
  if (!userId) throw new Error('You must be signed in to perform this action.');
  return userId;
};

export function useWorkOrders() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['work-orders', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('work_orders')
        .select(`
          *,
          products (id, name, selling_price),
          bill_of_materials (id, name, labor_cost_per_unit, overhead_cost_per_unit),
          work_order_materials (
            id, work_order_id, raw_material_id, quantity_required, quantity_used, unit_cost, total_cost,
            raw_materials (id, name, current_stock, cost_per_unit)
          ),
          branches (id, name)
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;

      const materialIds = [
        ...new Set(
          (data || []).flatMap((workOrder) =>
            (workOrder.work_order_materials || []).map((material) => material.id),
          ),
        ),
      ];
      const batchesByMaterial = new Map<
        string,
        { batch_number: string; quantity: number }[]
      >();
      if (materialIds.length > 0) {
        const { data: movements, error: movementsError } = await supabase
          .from('inventory_batch_movements')
          .select('source_id, quantity, inventory_batches(batch_number)')
          .eq('source_type', 'work_order_material')
          .eq('direction', 'out')
          .in('source_id', materialIds);
        if (movementsError) throw movementsError;

        for (const movement of movements || []) {
          if (!movement.source_id) continue;
          const batch = Array.isArray(movement.inventory_batches)
            ? movement.inventory_batches[0]
            : movement.inventory_batches;
          if (!batch) continue;
          const allocations = batchesByMaterial.get(movement.source_id) || [];
          allocations.push({
            batch_number: batch.batch_number,
            quantity: Number(movement.quantity),
          });
          batchesByMaterial.set(movement.source_id, allocations);
        }
      }

      // Fetch created_by user profiles
      const userIds = [...new Set(data?.map(d => d.created_by).filter(Boolean))];
      let profilesMap: Record<string, { full_name: string | null; email: string | null }> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .rpc('get_org_user_names', { _user_ids: userIds });
        if (profiles) {
          profilesMap = (profiles as Array<{ user_id: string; full_name: string | null; email: string | null }>).reduce((acc, p) => {
            acc[p.user_id] = { full_name: p.full_name, email: p.email };
            return acc;
          }, {} as Record<string, { full_name: string | null; email: string | null }>);
        }
      }

      return data.map(wo => ({
        ...wo,
        work_order_materials: (wo.work_order_materials || []).map((material) => ({
          ...material,
          consumed_batches: batchesByMaterial.get(material.id) || [],
        })),
        created_by_user: wo.created_by
          ? profilesMap[wo.created_by] || (wo.created_by === user?.id
            ? {
                full_name: (user?.user_metadata?.full_name as string | undefined) || (user?.user_metadata?.name as string | undefined) || null,
                email: user?.email ?? null,
              }
            : null)
          : null,
      })) as WorkOrder[];
    },
  });
}

export function useCreateWorkOrder() {
  const queryClient = useQueryClient();
  const { user, organizationId } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (input: WorkOrderInput) => {
      const actorId = requireAuthenticatedUserId(user?.id);
      if (!organizationId) throw new Error('No organization');

      const { data: woNumber } = await supabase.rpc('generate_work_order_number', { org_id: organizationId });

      const { data: bomItems, error: bomError } = await supabase
        .from('bom_items')
        .select('raw_material_id, quantity_required, raw_materials (cost_per_unit)')
        .eq('bom_id', input.bom_id);
      if (bomError) throw bomError;

      const { data: bom } = await supabase
        .from('bill_of_materials')
        .select('labor_cost_per_unit, overhead_cost_per_unit')
        .eq('id', input.bom_id)
        .single();

      const laborCost = input.labor_cost ?? (bom?.labor_cost_per_unit || 0) * input.quantity;
      const overheadCost = input.overhead_cost ?? (bom?.overhead_cost_per_unit || 0) * input.quantity;

      let materialCost = 0;
      const materials = bomItems?.map((item: any) => {
        const qtyRequired = Number(item.quantity_required) * input.quantity;
        const unitCost = Number(item.raw_materials?.cost_per_unit || 0);
        const totalCost = qtyRequired * unitCost;
        materialCost += totalCost;
        return {
          raw_material_id: item.raw_material_id,
          quantity_required: qtyRequired,
          unit_cost: unitCost,
          total_cost: totalCost,
        };
      }) || [];

      const totalCost = materialCost + laborCost + overheadCost;
      const costPerUnit = input.quantity > 0 ? totalCost / input.quantity : 0;

      const { data: wo, error } = await supabase
        .from('work_orders')
        .insert({
          organization_id: organizationId,
          branch_id: input.branch_id || null,
          work_order_number: woNumber || 'WO-00001',
          product_id: input.product_id,
          bom_id: input.bom_id,
          quantity: input.quantity,
          labor_cost: laborCost,
          overhead_cost: overheadCost,
          material_cost: materialCost,
          total_cost: totalCost,
          cost_per_unit: costPerUnit,
          notes: input.notes,
          created_by: actorId,
        })
        .select()
        .single();
      if (error) throw error;

      if (materials.length > 0) {
        const { error: matError } = await supabase
          .from('work_order_materials')
          .insert(materials.map((m) => ({ work_order_id: wo.id, ...m })));
        if (matError) throw matError;
      }

      return wo;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
      toast({ title: 'Work order created' });
    },
    onError: (error: Error) => {
      const { title, description } = parseDbError(error, 'create work order');
      toast({ title, description, variant: 'destructive' });
    },
  });
}

export function useUpdateWorkOrder() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: WorkOrderInput }) => {
      // Recalculate costs based on updated BOM/quantity
      const { data: bomItems, error: bomError } = await supabase
        .from('bom_items')
        .select('raw_material_id, quantity_required, raw_materials (cost_per_unit)')
        .eq('bom_id', input.bom_id);
      if (bomError) throw bomError;

      const { data: bom } = await supabase
        .from('bill_of_materials')
        .select('labor_cost_per_unit, overhead_cost_per_unit')
        .eq('id', input.bom_id)
        .single();

      const laborCost = input.labor_cost ?? (bom?.labor_cost_per_unit || 0) * input.quantity;
      const overheadCost = input.overhead_cost ?? (bom?.overhead_cost_per_unit || 0) * input.quantity;

      let materialCost = 0;
      const materials = bomItems?.map((item: any) => {
        const qtyRequired = Number(item.quantity_required) * input.quantity;
        const unitCost = Number(item.raw_materials?.cost_per_unit || 0);
        const totalCost = qtyRequired * unitCost;
        materialCost += totalCost;
        return {
          raw_material_id: item.raw_material_id,
          quantity_required: qtyRequired,
          unit_cost: unitCost,
          total_cost: totalCost,
        };
      }) || [];

      const totalCost = materialCost + laborCost + overheadCost;
      const costPerUnit = input.quantity > 0 ? totalCost / input.quantity : 0;

      const { error } = await supabase
        .from('work_orders')
        .update({
          product_id: input.product_id,
          bom_id: input.bom_id,
          branch_id: input.branch_id || null,
          quantity: input.quantity,
          labor_cost: laborCost,
          overhead_cost: overheadCost,
          material_cost: materialCost,
          total_cost: totalCost,
          cost_per_unit: costPerUnit,
          notes: input.notes,
        })
        .eq('id', id);
      if (error) throw error;

      // Replace work order materials
      await supabase.from('work_order_materials').delete().eq('work_order_id', id);
      if (materials.length > 0) {
        const { error: matError } = await supabase
          .from('work_order_materials')
          .insert(materials.map((m) => ({ work_order_id: id, ...m })));
        if (matError) throw matError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
      toast({ title: 'Work order updated' });
    },
    onError: (error: Error) => {
      const { title, description } = parseDbError(error, 'update work order');
      toast({ title, description, variant: 'destructive' });
    },
  });
}

export function useApproveWorkOrder() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (workOrder: WorkOrder) => {
      const { error } = await supabase.rpc('approve_work_order_with_batches', {
        _work_order_id: workOrder.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
      queryClient.invalidateQueries({ queryKey: ['raw-materials'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-batches'] });
      toast({ title: 'Work order approved, raw materials deducted' });
    },
    onError: (error: Error) => {
      toast({ title: 'Approval failed', description: error.message, variant: 'destructive' });
    },
  });
}

export function useCompleteWorkOrder() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      workOrder,
      expirationDate,
    }: {
      workOrder: WorkOrder;
      expirationDate?: string | null;
    }) => {
      const { data, error } = await supabase.rpc('complete_work_order_with_batch', {
        _work_order_id: workOrder.id,
        _expiration_date: expirationDate || null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['stock-history'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-batches'] });
      toast({ title: 'Work order completed, finished goods added to stock' });
    },
    onError: (error: Error) => {
      toast({ title: 'Completion failed', description: error.message, variant: 'destructive' });
    },
  });
}

export function useCancelWorkOrder() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc('cancel_work_order_with_batches', {
        _work_order_id: id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
      queryClient.invalidateQueries({ queryKey: ['raw-materials'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-batches'] });
      toast({ title: 'Work order cancelled' });
    },
    onError: (error: Error) => {
      toast({ title: 'Cancel failed', description: error.message, variant: 'destructive' });
    },
  });
}

export function useRecordDamage() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ productId, quantity, notes }: { productId: string; quantity: number; notes?: string }) => {
      const { error } = await supabase.rpc('adjust_product_batch_stock', {
        _product_id: productId,
        _change_amount: -quantity,
        _notes: notes || 'Finished goods damage recorded',
        _change_type: 'damage',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['stock-history'] });
      queryClient.invalidateQueries({ queryKey: ['damage-history'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-batches'] });
      toast({ title: 'Damage recorded successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to record damage', description: error.message, variant: 'destructive' });
    },
  });
}

export function useRecordWaste() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ materialId, quantity, notes }: { materialId: string; quantity: number; notes?: string }) => {
      const { error } = await supabase.rpc('adjust_raw_material_batch_stock', {
        _raw_material_id: materialId,
        _change_amount: -quantity,
        _notes: notes || 'Raw material waste recorded',
        _change_type: 'waste',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['raw-materials'] });
      queryClient.invalidateQueries({ queryKey: ['waste-history'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-batches'] });
      toast({ title: 'Waste recorded successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to record waste', description: error.message, variant: 'destructive' });
    },
  });
}
