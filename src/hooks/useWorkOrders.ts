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

export function useWorkOrders() {
  return useQuery({
    queryKey: ['work-orders'],
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

      // Fetch created_by user profiles
      const userIds = [...new Set(data?.map(d => d.created_by).filter(Boolean))];
      let profilesMap: Record<string, { full_name: string | null; email: string | null }> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, full_name, email')
          .in('user_id', userIds);
        if (profiles) {
          profilesMap = profiles.reduce((acc, p) => {
            acc[p.user_id] = { full_name: p.full_name, email: p.email };
            return acc;
          }, {} as Record<string, { full_name: string | null; email: string | null }>);
        }
      }

      return data.map(wo => ({
        ...wo,
        created_by_user: wo.created_by ? profilesMap[wo.created_by] || null : null,
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
          created_by: user?.id,
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
  const { user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (workOrder: WorkOrder) => {
      const materials = workOrder.work_order_materials || [];
      for (const mat of materials) {
        const currentStock = mat.raw_materials?.current_stock || 0;
        if (currentStock < mat.quantity_required) {
          throw new Error(`Insufficient stock for ${mat.raw_materials?.name}. Need ${mat.quantity_required}, have ${currentStock}`);
        }
      }

      for (const mat of materials) {
        const currentStock = Number(mat.raw_materials?.current_stock || 0);
        const newStock = currentStock - Number(mat.quantity_required);

        await supabase
          .from('raw_materials')
          .update({ current_stock: newStock })
          .eq('id', mat.raw_material_id);

        await supabase.from('raw_material_stock_history').insert({
          raw_material_id: mat.raw_material_id,
          previous_stock: currentStock,
          new_stock: newStock,
          change_amount: -Number(mat.quantity_required),
          change_type: 'production_deduction',
          reference_type: 'work_order',
          reference_id: workOrder.id,
          notes: `Deducted for ${workOrder.work_order_number}`,
          changed_by: user?.id,
        });
      }

      const { error } = await supabase
        .from('work_orders')
        .update({ status: 'approved', approved_at: new Date().toISOString() })
        .eq('id', workOrder.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
      queryClient.invalidateQueries({ queryKey: ['raw-materials'] });
      toast({ title: 'Work order approved, raw materials deducted' });
    },
    onError: (error: Error) => {
      toast({ title: 'Approval failed', description: error.message, variant: 'destructive' });
    },
  });
}

export function useCompleteWorkOrder() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (workOrder: WorkOrder) => {
      const { data: product } = await supabase
        .from('products')
        .select('current_stock')
        .eq('id', workOrder.product_id)
        .single();

      if (product) {
        const currentStock = Number(product.current_stock);
        const newStock = currentStock + Number(workOrder.quantity);

        await supabase
          .from('products')
          .update({ current_stock: newStock })
          .eq('id', workOrder.product_id);

        await supabase.from('stock_history').insert({
          product_id: workOrder.product_id,
          previous_stock: currentStock,
          new_stock: newStock,
          change_amount: Number(workOrder.quantity),
          change_type: 'production',
          notes: `Produced via ${workOrder.work_order_number}`,
          changed_by: user?.id,
        });
      }

      const { error } = await supabase
        .from('work_orders')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', workOrder.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['stock-history'] });
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
      const { error } = await supabase
        .from('work_orders')
        .update({ status: 'cancelled' })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['work-orders'] });
      toast({ title: 'Work order cancelled' });
    },
    onError: (error: Error) => {
      toast({ title: 'Cancel failed', description: error.message, variant: 'destructive' });
    },
  });
}

export function useRecordDamage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ productId, quantity, notes }: { productId: string; quantity: number; notes?: string }) => {
      const { data: product } = await supabase
        .from('products')
        .select('current_stock')
        .eq('id', productId)
        .single();
      if (!product) throw new Error('Product not found');

      const currentStock = Number(product.current_stock);
      if (quantity > currentStock) throw new Error('Damage quantity exceeds current stock');
      const newStock = currentStock - quantity;

      await supabase.from('products').update({ current_stock: newStock }).eq('id', productId);
      await supabase.from('stock_history').insert({
        product_id: productId,
        previous_stock: currentStock,
        new_stock: newStock,
        change_amount: -quantity,
        change_type: 'damage',
        notes: notes || 'Finished goods damage recorded',
        changed_by: user?.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['stock-history'] });
      toast({ title: 'Damage recorded successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to record damage', description: error.message, variant: 'destructive' });
    },
  });
}

export function useRecordWaste() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ materialId, quantity, notes }: { materialId: string; quantity: number; notes?: string }) => {
      const { data: material } = await supabase
        .from('raw_materials')
        .select('current_stock')
        .eq('id', materialId)
        .single();
      if (!material) throw new Error('Raw material not found');

      const currentStock = Number(material.current_stock);
      if (quantity > currentStock) throw new Error('Waste quantity exceeds current stock');
      const newStock = currentStock - quantity;

      await supabase.from('raw_materials').update({ current_stock: newStock }).eq('id', materialId);
      await supabase.from('raw_material_stock_history').insert({
        raw_material_id: materialId,
        previous_stock: currentStock,
        new_stock: newStock,
        change_amount: -quantity,
        change_type: 'waste',
        notes: notes || 'Raw material waste recorded',
        changed_by: user?.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['raw-materials'] });
      toast({ title: 'Waste recorded successfully' });
    },
    onError: (error: Error) => {
      toast({ title: 'Failed to record waste', description: error.message, variant: 'destructive' });
    },
  });
}
