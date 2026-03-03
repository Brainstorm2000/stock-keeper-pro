import { useState } from 'react';
import { Plus, Search, CheckCircle2, Clock, XCircle, PlayCircle, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import {
  useWorkOrders, useCreateWorkOrder, useApproveWorkOrder, useCompleteWorkOrder, useCancelWorkOrder,
  type WorkOrder,
} from '@/hooks/useWorkOrders';
import { useBOMs } from '@/hooks/useBOM';
import { useModuleAccess } from '@/components/access/ModuleAccessGuard';
import { formatCurrency } from '@/lib/currency';

const STATUS_CONFIG: Record<string, { label: string; icon: React.ComponentType<any>; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'Draft', icon: Clock, variant: 'secondary' },
  approved: { label: 'Approved', icon: CheckCircle2, variant: 'default' },
  in_progress: { label: 'In Progress', icon: PlayCircle, variant: 'outline' },
  completed: { label: 'Completed', icon: CheckCircle2, variant: 'default' },
  cancelled: { label: 'Cancelled', icon: XCircle, variant: 'destructive' },
};

export function WorkOrdersTab() {
  const { data: workOrders = [], isLoading } = useWorkOrders();
  const { data: boms = [] } = useBOMs();
  const createWO = useCreateWorkOrder();
  const approveWO = useApproveWorkOrder();
  const completeWO = useCompleteWorkOrder();
  const cancelWO = useCancelWorkOrder();
  const { canCreate } = useModuleAccess('production');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{ type: 'approve' | 'complete' | 'cancel'; wo: WorkOrder } | null>(null);

  // Form
  const [bomId, setBomId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [laborCost, setLaborCost] = useState('');
  const [overheadCost, setOverheadCost] = useState('');
  const [notes, setNotes] = useState('');

  const selectedBom = boms.find((b) => b.id === bomId);

  const filtered = workOrders.filter((wo) => {
    const matchSearch = wo.work_order_number.toLowerCase().includes(search.toLowerCase()) ||
      wo.products?.name?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || wo.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const resetForm = () => { setBomId(''); setQuantity(''); setLaborCost(''); setOverheadCost(''); setNotes(''); };

  const handleCreate = async () => {
    if (!bomId || !quantity || !selectedBom) return;
    await createWO.mutateAsync({
      product_id: selectedBom.product_id,
      bom_id: bomId,
      quantity: Number(quantity),
      labor_cost: laborCost ? Number(laborCost) : undefined,
      overhead_cost: overheadCost ? Number(overheadCost) : undefined,
      notes: notes || undefined,
    });
    setDialogOpen(false);
    resetForm();
  };

  const handleConfirmAction = async () => {
    if (!confirmAction) return;
    if (confirmAction.type === 'approve') await approveWO.mutateAsync(confirmAction.wo);
    else if (confirmAction.type === 'complete') await completeWO.mutateAsync(confirmAction.wo);
    else if (confirmAction.type === 'cancel') await cancelWO.mutateAsync(confirmAction.wo.id);
    setConfirmAction(null);
  };

  // Stats
  const draftCount = workOrders.filter((w) => w.status === 'draft').length;
  const activeCount = workOrders.filter((w) => ['approved', 'in_progress'].includes(w.status)).length;
  const completedCount = workOrders.filter((w) => w.status === 'completed').length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Draft</p><p className="text-2xl font-bold">{draftCount}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Active</p><p className="text-2xl font-bold text-primary">{activeCount}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Completed</p><p className="text-2xl font-bold text-primary">{completedCount}</p></CardContent></Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-3 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search work orders..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {canCreate && (
          <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />New Work Order
          </Button>
        )}
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>WO Number</TableHead>
              <TableHead>Product</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">Material</TableHead>
              <TableHead className="text-right">Labor</TableHead>
              <TableHead className="text-right">Total Cost</TableHead>
              <TableHead className="text-right">Cost/Unit</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="w-[150px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">No work orders found</TableCell></TableRow>
            ) : (
              filtered.map((wo) => {
                const cfg = STATUS_CONFIG[wo.status] || STATUS_CONFIG.draft;
                const Icon = cfg.icon;
                return (
                  <TableRow key={wo.id}>
                    <TableCell className="font-medium">{wo.work_order_number}</TableCell>
                    <TableCell>{wo.products?.name || '—'}</TableCell>
                    <TableCell className="text-right">{Number(wo.quantity)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(wo.material_cost)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(wo.labor_cost + wo.overhead_cost)}</TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(wo.total_cost)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(wo.cost_per_unit)}</TableCell>
                    <TableCell>
                      <Badge variant={cfg.variant} className="gap-1"><Icon className="h-3 w-3" />{cfg.label}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{format(new Date(wo.created_at), 'MMM d, yyyy')}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {wo.status === 'draft' && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => setConfirmAction({ type: 'approve', wo })}>Approve</Button>
                            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setConfirmAction({ type: 'cancel', wo })}>Cancel</Button>
                          </>
                        )}
                        {wo.status === 'approved' && (
                          <Button size="sm" onClick={() => setConfirmAction({ type: 'complete', wo })}>Complete</Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>New Work Order</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Bill of Materials *</Label>
              <Select value={bomId} onValueChange={setBomId}>
                <SelectTrigger><SelectValue placeholder="Select BOM" /></SelectTrigger>
                <SelectContent>{boms.map((b) => <SelectItem key={b.id} value={b.id}>{b.name} — {b.products?.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {selectedBom && (
              <div className="text-sm text-muted-foreground p-3 rounded-md bg-muted">
                <p>Product: <span className="font-medium text-foreground">{selectedBom.products?.name}</span></p>
                <p>Materials: {selectedBom.bom_items?.length || 0} items</p>
              </div>
            )}
            <div className="space-y-2"><Label>Quantity to Produce *</Label><Input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)} /></div>
            {selectedBom && quantity && Number(quantity) > 0 && (
              <div className="text-sm space-y-1 p-3 rounded-md bg-muted">
                <p className="font-medium">Material Requirements:</p>
                {selectedBom.bom_items?.map((item) => {
                  const needed = Number(item.quantity_required) * Number(quantity);
                  const available = Number(item.raw_materials?.current_stock || 0);
                  const insufficient = available < needed;
                  return (
                    <div key={item.id} className="flex justify-between">
                      <span>{item.raw_materials?.name}</span>
                      <span className={insufficient ? 'text-destructive font-medium' : ''}>
                        {needed} needed / {available} available
                        {insufficient && <AlertTriangle className="h-3 w-3 inline ml-1" />}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Labor Cost (Override)</Label><Input type="number" min="0" value={laborCost} onChange={(e) => setLaborCost(e.target.value)} placeholder="Auto from BOM" /></div>
              <div className="space-y-2"><Label>Overhead Cost (Override)</Label><Input type="number" min="0" value={overheadCost} onChange={(e) => setOverheadCost(e.target.value)} placeholder="Auto from BOM" /></div>
            </div>
            <div className="space-y-2"><Label>Notes</Label><Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!bomId || !quantity || Number(quantity) <= 0}>Create</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Action Dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.type === 'approve' && 'Approve Work Order?'}
              {confirmAction?.type === 'complete' && 'Complete Work Order?'}
              {confirmAction?.type === 'cancel' && 'Cancel Work Order?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.type === 'approve' && 'This will deduct raw materials from stock. Ensure sufficient stock is available.'}
              {confirmAction?.type === 'complete' && `This will add ${confirmAction?.wo.quantity} finished goods to product stock.`}
              {confirmAction?.type === 'cancel' && 'This work order will be marked as cancelled.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmAction}
              className={confirmAction?.type === 'cancel' ? 'bg-destructive text-destructive-foreground' : ''}
            >
              {confirmAction?.type === 'approve' && 'Approve'}
              {confirmAction?.type === 'complete' && 'Complete'}
              {confirmAction?.type === 'cancel' && 'Cancel Order'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
