import { useState } from 'react';
import { Plus, Pencil, Trash2, Search, Package, ArrowUpDown, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { useRawMaterials, useCreateRawMaterial, useUpdateRawMaterial, useDeleteRawMaterial, useUpdateRawMaterialStock, type RawMaterial } from '@/hooks/useRawMaterials';
import { useRecordWaste } from '@/hooks/useWorkOrders';
import { useUnits } from '@/hooks/useUnits';
import { useModuleAccess } from '@/components/access/ModuleAccessGuard';
import { formatCurrency } from '@/lib/currency';

export function RawMaterialsTab() {
  const { data: materials = [], isLoading } = useRawMaterials();
  const { data: units = [] } = useUnits();
  const createMaterial = useCreateRawMaterial();
  const updateMaterial = useUpdateRawMaterial();
  const deleteMaterial = useDeleteRawMaterial();
  const updateStock = useUpdateRawMaterialStock();
  const recordWaste = useRecordWaste();
  const { canCreate, canEdit, canDelete } = useModuleAccess('production');

  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [stockDialogOpen, setStockDialogOpen] = useState(false);
  const [wasteDialogOpen, setWasteDialogOpen] = useState(false);
  const [editing, setEditing] = useState<RawMaterial | null>(null);
  const [stockMaterial, setStockMaterial] = useState<RawMaterial | null>(null);
  const [wasteMaterial, setWasteMaterial] = useState<RawMaterial | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [unitId, setUnitId] = useState('');
  const [costPerUnit, setCostPerUnit] = useState('');
  const [currentStock, setCurrentStock] = useState('');
  const [lowStockThreshold, setLowStockThreshold] = useState('10');
  const [sku, setSku] = useState('');
  const [description, setDescription] = useState('');

  // Stock adjustment
  const [stockChange, setStockChange] = useState('');
  const [stockChangeType, setStockChangeType] = useState<'increase' | 'decrease'>('increase');
  const [stockNotes, setStockNotes] = useState('');

  // Waste
  const [wasteQty, setWasteQty] = useState('');
  const [wasteNotes, setWasteNotes] = useState('');

  const filtered = materials.filter((m) =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.sku?.toLowerCase().includes(search.toLowerCase())
  );

  const getStockStatus = (m: RawMaterial) => {
    if (m.current_stock <= 0) return 'out_of_stock';
    if (m.current_stock <= m.low_stock_threshold) return 'low';
    return 'normal';
  };

  const resetForm = () => {
    setName(''); setUnitId(''); setCostPerUnit(''); setCurrentStock('');
    setLowStockThreshold('10'); setSku(''); setDescription(''); setEditing(null);
  };

  const openEdit = (m: RawMaterial) => {
    setEditing(m); setName(m.name); setUnitId(m.unit_id);
    setCostPerUnit(String(m.cost_per_unit)); setCurrentStock(String(m.current_stock));
    setLowStockThreshold(String(m.low_stock_threshold)); setSku(m.sku || '');
    setDescription(m.description || ''); setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!name || !unitId) return;
    const data = {
      name, unit_id: unitId, cost_per_unit: Number(costPerUnit) || 0,
      current_stock: Number(currentStock) || 0, low_stock_threshold: Number(lowStockThreshold) || 10,
      sku: sku || undefined, description: description || undefined,
    };
    if (editing) await updateMaterial.mutateAsync({ id: editing.id, ...data });
    else await createMaterial.mutateAsync(data);
    setDialogOpen(false); resetForm();
  };

  const handleStockUpdate = async () => {
    if (!stockMaterial || !stockChange) return;
    const change = Number(stockChange);
    const current = Number(stockMaterial.current_stock);
    const newStock = stockChangeType === 'increase' ? current + change : current - change;
    if (newStock < 0) return;
    await updateStock.mutateAsync({
      materialId: stockMaterial.id, currentStock: current, newStock,
      changeType: stockChangeType === 'increase' ? 'purchase' : 'adjustment',
      notes: stockNotes || undefined,
    });
    setStockDialogOpen(false); setStockMaterial(null); setStockChange(''); setStockNotes('');
  };

  const handleRecordWaste = async () => {
    if (!wasteMaterial || !wasteQty || Number(wasteQty) <= 0) return;
    await recordWaste.mutateAsync({
      materialId: wasteMaterial.id, quantity: Number(wasteQty), notes: wasteNotes || undefined,
    });
    setWasteDialogOpen(false); setWasteMaterial(null); setWasteQty(''); setWasteNotes('');
  };

  const totalValue = filtered.reduce((sum, m) => sum + m.current_stock * m.cost_per_unit, 0);
  const lowStockCount = filtered.filter((m) => getStockStatus(m) !== 'normal').length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card><CardContent className="pt-6"><div className="flex items-center gap-3"><div className="p-2 rounded-lg bg-primary/10"><Package className="h-5 w-5 text-primary" /></div><div><p className="text-sm text-muted-foreground">Total Materials</p><p className="text-2xl font-bold">{filtered.length}</p></div></div></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Inventory Value</p><p className="text-2xl font-bold">{formatCurrency(totalValue)}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Low Stock Alerts</p><p className="text-2xl font-bold text-destructive">{lowStockCount}</p></CardContent></Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search materials..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        {canCreate && (
          <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />Add Material
          </Button>
        )}
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead className="text-right">Cost/Unit</TableHead>
              <TableHead className="text-right">Stock</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[160px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No raw materials found</TableCell></TableRow>
            ) : (
              filtered.map((m) => {
                const status = getStockStatus(m);
                return (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">{m.name}</TableCell>
                    <TableCell className="text-muted-foreground">{m.sku || '—'}</TableCell>
                    <TableCell>{m.units?.abbreviation || m.units?.name || '—'}</TableCell>
                    <TableCell className="text-right">{formatCurrency(m.cost_per_unit)}</TableCell>
                    <TableCell className="text-right font-semibold">{Number(m.current_stock).toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant={status === 'normal' ? 'secondary' : 'destructive'}>
                        {status === 'out_of_stock' ? 'Out of Stock' : status === 'low' ? 'Low Stock' : 'In Stock'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => { setStockMaterial(m); setStockDialogOpen(true); }} title="Adjust Stock">
                          <ArrowUpDown className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => { setWasteMaterial(m); setWasteDialogOpen(true); }} title="Record Waste" className="text-destructive">
                          <AlertTriangle className="h-4 w-4" />
                        </Button>
                        {canEdit && (
                          <Button variant="ghost" size="icon" onClick={() => openEdit(m)}><Pencil className="h-4 w-4" /></Button>
                        )}
                        {canDelete && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-destructive"><Trash2 className="h-4 w-4" /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete {m.name}?</AlertDialogTitle>
                                <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteMaterial.mutate(m.id)} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
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

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editing ? 'Edit' : 'Add'} Raw Material</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>Name *</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Steel Rod" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Unit *</Label>
                <Select value={unitId} onValueChange={setUnitId}>
                  <SelectTrigger><SelectValue placeholder="Select unit" /></SelectTrigger>
                  <SelectContent>{units.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>SKU</Label><Input value={sku} onChange={(e) => setSku(e.target.value)} placeholder="Optional" /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Cost per Unit</Label><Input type="number" min="0" step="0.01" value={costPerUnit} onChange={(e) => setCostPerUnit(e.target.value)} /></div>
              {!editing && <div className="space-y-2"><Label>Opening Stock</Label><Input type="number" min="0" value={currentStock} onChange={(e) => setCurrentStock(e.target.value)} /></div>}
            </div>
            <div className="space-y-2"><Label>Low Stock Threshold</Label><Input type="number" min="0" value={lowStockThreshold} onChange={(e) => setLowStockThreshold(e.target.value)} /></div>
            <div className="space-y-2"><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={!name || !unitId}>{editing ? 'Update' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Stock Adjustment Dialog */}
      <Dialog open={stockDialogOpen} onOpenChange={(open) => { setStockDialogOpen(open); if (!open) { setStockMaterial(null); setStockChange(''); setStockNotes(''); } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Adjust Stock — {stockMaterial?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Current stock: <span className="font-semibold text-foreground">{stockMaterial?.current_stock}</span></p>
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={stockChangeType} onValueChange={(v) => setStockChangeType(v as 'increase' | 'decrease')}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="increase">Increase (Purchase)</SelectItem>
                  <SelectItem value="decrease">Decrease (Adjustment)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Quantity</Label><Input type="number" min="1" value={stockChange} onChange={(e) => setStockChange(e.target.value)} /></div>
            <div className="space-y-2"><Label>Notes</Label><Input value={stockNotes} onChange={(e) => setStockNotes(e.target.value)} placeholder="Optional" /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStockDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleStockUpdate} disabled={!stockChange || Number(stockChange) <= 0}>Update Stock</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record Waste Dialog */}
      <Dialog open={wasteDialogOpen} onOpenChange={(open) => { setWasteDialogOpen(open); if (!open) { setWasteMaterial(null); setWasteQty(''); setWasteNotes(''); } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Record Waste — {wasteMaterial?.name}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Current stock: <span className="font-semibold text-foreground">{wasteMaterial?.current_stock}</span></p>
            <div className="space-y-2"><Label>Waste Quantity *</Label><Input type="number" min="1" max={wasteMaterial?.current_stock} value={wasteQty} onChange={(e) => setWasteQty(e.target.value)} /></div>
            <div className="space-y-2"><Label>Reason / Notes</Label><Textarea value={wasteNotes} onChange={(e) => setWasteNotes(e.target.value)} rows={2} placeholder="e.g. Expired, contaminated..." /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWasteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleRecordWaste} disabled={!wasteQty || Number(wasteQty) <= 0}>Record Waste</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
