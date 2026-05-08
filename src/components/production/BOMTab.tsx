import { useState } from 'react';
import { Plus, Trash2, Pencil, Search, Eye, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Textarea } from '@/components/ui/textarea';
import { useBOMs, useCreateBOM, useUpdateBOM, useDeleteBOM, type BOM } from '@/hooks/useBOM';
import { useToast } from '@/hooks/use-toast';
import { useProducts } from '@/hooks/useProducts';
import { useRawMaterials } from '@/hooks/useRawMaterials';
import { useModuleAccess } from '@/components/access/ModuleAccessGuard';
import { formatCurrency } from '@/lib/currency';

interface BOMItemForm {
  raw_material_id: string;
  quantity_required: number;
}

export function BOMTab() {
  const { data: boms = [], isLoading } = useBOMs();
  const { data: products = [] } = useProducts();
  const { data: materials = [] } = useRawMaterials();
  const createBOM = useCreateBOM();
  const updateBOM = useUpdateBOM();
  const deleteBOM = useDeleteBOM();
  const { canCreate, canEdit, canDelete } = useModuleAccess('production');
  const { toast } = useToast();

  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [detailBom, setDetailBom] = useState<BOM | null>(null);
  const [editing, setEditing] = useState<BOM | null>(null);

  // Form
  const [name, setName] = useState('');
  const [productId, setProductId] = useState('');
  const [description, setDescription] = useState('');
  const [laborCost, setLaborCost] = useState('0');
  const [overheadCost, setOverheadCost] = useState('0');
  const [items, setItems] = useState<BOMItemForm[]>([]);

  const filtered = boms.filter((b) => b.name.toLowerCase().includes(search.toLowerCase()));

  const sellableProducts = products.filter((p) => p.category === 'sellable');

  const resetForm = () => {
    setName(''); setProductId(''); setDescription(''); setLaborCost('0'); setOverheadCost('0');
    setItems([]); setEditing(null);
  };

  const openEdit = (b: BOM) => {
    setEditing(b);
    setName(b.name);
    setProductId(b.product_id);
    setDescription(b.description || '');
    setLaborCost(String(b.labor_cost_per_unit));
    setOverheadCost(String(b.overhead_cost_per_unit));
    setItems(b.bom_items?.map((i) => ({ raw_material_id: i.raw_material_id, quantity_required: Number(i.quantity_required) })) || []);
    setDialogOpen(true);
  };

  const addItem = () => setItems([...items, { raw_material_id: '', quantity_required: 0 }]);
  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx));
  const updateItem = (idx: number, field: keyof BOMItemForm, value: string | number) => {
    const updated = [...items];
    if (field === 'raw_material_id' && value && updated.some((it, i) => i !== idx && it.raw_material_id === value)) {
      toast({ title: 'Duplicate material', description: 'This material is already in the list.', variant: 'destructive' });
      return;
    }
    updated[idx] = { ...updated[idx], [field]: field === 'quantity_required' ? Number(value) : value };
    setItems(updated);
  };

  const calcMaterialCost = (bomItems?: BOM['bom_items']) => {
    if (!bomItems) return 0;
    return bomItems.reduce((sum, item) => sum + Number(item.quantity_required) * Number(item.raw_materials?.cost_per_unit || 0), 0);
  };

  const handleSubmit = async () => {
    if (!name || !productId || items.length === 0) return;
    const validItems = items.filter((i) => i.raw_material_id && i.quantity_required > 0);
    if (validItems.length === 0) return;
    const ids = validItems.map((i) => i.raw_material_id);
    if (new Set(ids).size !== ids.length) {
      toast({ title: 'Duplicate materials', description: 'Each material can only appear once.', variant: 'destructive' });
      return;
    }

    const data = {
      name, product_id: productId, description: description || undefined,
      labor_cost_per_unit: Number(laborCost) || 0,
      overhead_cost_per_unit: Number(overheadCost) || 0,
      items: validItems,
    };

    if (editing) {
      await updateBOM.mutateAsync({ id: editing.id, ...data });
    } else {
      await createBOM.mutateAsync(data);
    }
    setDialogOpen(false);
    resetForm();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search BOMs..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        {canCreate && (
          <Button onClick={() => { resetForm(); setDialogOpen(true); }}>
            <Plus className="h-4 w-4 mr-2" />Create BOM
          </Button>
        )}
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>BOM Name</TableHead>
              <TableHead>Product</TableHead>
              <TableHead className="text-right">Material Cost/Unit</TableHead>
              <TableHead className="text-right">Labor/Unit</TableHead>
              <TableHead className="text-right">Overhead/Unit</TableHead>
              <TableHead className="text-right">Total Cost/Unit</TableHead>
              <TableHead className="w-[100px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No BOMs found</TableCell></TableRow>
            ) : (
              filtered.map((b) => {
                const matCost = calcMaterialCost(b.bom_items);
                const totalCost = matCost + Number(b.labor_cost_per_unit) + Number(b.overhead_cost_per_unit);
                return (
                  <TableRow key={b.id}>
                    <TableCell className="font-medium">{b.name}</TableCell>
                    <TableCell>{b.products?.name || '—'}</TableCell>
                    <TableCell className="text-right">{formatCurrency(matCost)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(b.labor_cost_per_unit)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(b.overhead_cost_per_unit)}</TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(totalCost)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => setDetailBom(b)}><Eye className="h-4 w-4" /></Button>
                        {canEdit && <Button variant="ghost" size="icon" onClick={() => openEdit(b)}><Pencil className="h-4 w-4" /></Button>}
                        {canDelete && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader><AlertDialogTitle>Delete {b.name}?</AlertDialogTitle><AlertDialogDescription>This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                              <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => deleteBOM.mutate(b.id)} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction></AlertDialogFooter>
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

      {/* Detail Dialog */}
      <Dialog open={!!detailBom} onOpenChange={(open) => !open && setDetailBom(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{detailBom?.name} — Materials</DialogTitle></DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Material</TableHead>
                <TableHead>Unit</TableHead>
                <TableHead className="text-right">Qty Required</TableHead>
                <TableHead className="text-right">Cost</TableHead>
                <TableHead className="text-right">Available</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {detailBom?.bom_items?.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.raw_materials?.name}</TableCell>
                  <TableCell>{item.raw_materials?.units?.abbreviation || item.raw_materials?.units?.name || '—'}</TableCell>
                  <TableCell className="text-right">{Number(item.quantity_required)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(Number(item.quantity_required) * Number(item.raw_materials?.cost_per_unit || 0))}</TableCell>
                  <TableCell className="text-right">{Number(item.raw_materials?.current_stock || 0)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Edit' : 'Create'} Bill of Materials</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2"><Label>BOM Name *</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Widget Assembly" /></div>
            <div className="space-y-2">
              <Label>Product *</Label>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                <SelectContent>{sellableProducts.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label>Labor Cost/Unit</Label><Input type="number" min="0" value={laborCost} onChange={(e) => setLaborCost(e.target.value)} /></div>
              <div className="space-y-2"><Label>Overhead Cost/Unit</Label><Input type="number" min="0" value={overheadCost} onChange={(e) => setOverheadCost(e.target.value)} /></div>
            </div>
            <div className="space-y-2"><Label>Description</Label><Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} /></div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Materials *</Label>
                <Button type="button" variant="outline" size="sm" onClick={addItem}><Plus className="h-3 w-3 mr-1" />Add</Button>
              </div>
              {items.map((item, idx) => (
                <div key={idx} className="flex gap-2 items-end">
                  <div className="flex-1">
                    <Select value={item.raw_material_id} onValueChange={(v) => updateItem(idx, 'raw_material_id', v)}>
                      <SelectTrigger><SelectValue placeholder="Material" /></SelectTrigger>
                      <SelectContent>
                        {materials
                          .filter((m) => m.id === item.raw_material_id || !items.some((it, i) => i !== idx && it.raw_material_id === m.id))
                          .map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-24">
                    <Input type="number" min="0" step="0.01" placeholder="Qty" value={item.quantity_required || ''} onChange={(e) => updateItem(idx, 'quantity_required', e.target.value)} />
                  </div>
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(idx)} className="text-destructive"><X className="h-4 w-4" /></Button>
                </div>
              ))}
              {items.length === 0 && <p className="text-sm text-muted-foreground">Add at least one material</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={!name || !productId || items.length === 0}>{editing ? 'Update' : 'Create'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
