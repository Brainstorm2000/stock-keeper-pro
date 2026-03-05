import { useState } from 'react';
import { AlertTriangle, Search, Pencil, Trash2, Package, Beaker } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useProducts } from '@/hooks/useProducts';
import { useRawMaterials } from '@/hooks/useRawMaterials';
import { useRecordDamage, useRecordWaste } from '@/hooks/useWorkOrders';
import {
  useDamageHistory, useWasteHistory,
  useEditDamage, useDeleteDamage,
  useEditWaste, useDeleteWaste,
  type DamageRecord, type WasteRecord,
} from '@/hooks/useDamagesWaste';
import { useModuleAccess } from '@/components/access/ModuleAccessGuard';
import { formatCurrency } from '@/lib/currency';

export function DamagesTab() {
  const { data: products = [] } = useProducts();
  const { data: materials = [] } = useRawMaterials();
  const { data: damageHistory = [], isLoading: damageLoading } = useDamageHistory();
  const { data: wasteHistory = [], isLoading: wasteLoading } = useWasteHistory();
  const recordDamage = useRecordDamage();
  const recordWaste = useRecordWaste();
  const editDamage = useEditDamage();
  const deleteDamage = useDeleteDamage();
  const editWaste = useEditWaste();
  const deleteWaste = useDeleteWaste();
  const { canEdit, canDelete } = useModuleAccess('production');

  // Record damage form
  const [damageDialogOpen, setDamageDialogOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [damageQty, setDamageQty] = useState('');
  const [damageNotes, setDamageNotes] = useState('');

  // Record waste form
  const [wasteDialogOpen, setWasteDialogOpen] = useState(false);
  const [selectedMaterialId, setSelectedMaterialId] = useState('');
  const [wasteQty, setWasteQty] = useState('');
  const [wasteNotes, setWasteNotes] = useState('');

  // Edit damage
  const [editDamageDialog, setEditDamageDialog] = useState<DamageRecord | null>(null);
  const [editDamageQty, setEditDamageQty] = useState('');
  const [editDamageNotes, setEditDamageNotes] = useState('');

  // Edit waste
  const [editWasteDialog, setEditWasteDialog] = useState<WasteRecord | null>(null);
  const [editWasteQty, setEditWasteQty] = useState('');
  const [editWasteNotes, setEditWasteNotes] = useState('');

  // Delete confirmations
  const [deleteDamageRecord, setDeleteDamageRecord] = useState<DamageRecord | null>(null);
  const [deleteWasteRecord, setDeleteWasteRecord] = useState<WasteRecord | null>(null);

  const [search, setSearch] = useState('');

  const selectedProduct = products.find((p) => p.id === selectedProductId);
  const selectedMaterial = materials.find((m) => m.id === selectedMaterialId);

  const handleRecordDamage = async () => {
    if (!selectedProductId || !damageQty || Number(damageQty) <= 0) return;
    await recordDamage.mutateAsync({
      productId: selectedProductId,
      quantity: Number(damageQty),
      notes: damageNotes || undefined,
    });
    setDamageDialogOpen(false);
    setSelectedProductId(''); setDamageQty(''); setDamageNotes('');
  };

  const handleRecordWaste = async () => {
    if (!selectedMaterialId || !wasteQty || Number(wasteQty) <= 0) return;
    await recordWaste.mutateAsync({
      materialId: selectedMaterialId,
      quantity: Number(wasteQty),
      notes: wasteNotes || undefined,
    });
    setWasteDialogOpen(false);
    setSelectedMaterialId(''); setWasteQty(''); setWasteNotes('');
  };

  const handleEditDamage = async () => {
    if (!editDamageDialog || !editDamageQty || Number(editDamageQty) <= 0) return;
    await editDamage.mutateAsync({
      recordId: editDamageDialog.id,
      productId: editDamageDialog.product_id,
      oldChangeAmount: editDamageDialog.change_amount,
      newQuantity: Number(editDamageQty),
      notes: editDamageNotes || undefined,
    });
    setEditDamageDialog(null);
  };

  const handleEditWaste = async () => {
    if (!editWasteDialog || !editWasteQty || Number(editWasteQty) <= 0) return;
    await editWaste.mutateAsync({
      recordId: editWasteDialog.id,
      materialId: editWasteDialog.raw_material_id,
      oldChangeAmount: editWasteDialog.change_amount,
      newQuantity: Number(editWasteQty),
      notes: editWasteNotes || undefined,
    });
    setEditWasteDialog(null);
  };

  const handleDeleteDamage = async () => {
    if (!deleteDamageRecord) return;
    await deleteDamage.mutateAsync({
      recordId: deleteDamageRecord.id,
      productId: deleteDamageRecord.product_id,
      changeAmount: deleteDamageRecord.change_amount,
    });
    setDeleteDamageRecord(null);
  };

  const handleDeleteWaste = async () => {
    if (!deleteWasteRecord) return;
    await deleteWaste.mutateAsync({
      recordId: deleteWasteRecord.id,
      materialId: deleteWasteRecord.raw_material_id,
      changeAmount: deleteWasteRecord.change_amount,
    });
    setDeleteWasteRecord(null);
  };

  const openEditDamage = (record: DamageRecord) => {
    setEditDamageDialog(record);
    setEditDamageQty(String(Math.abs(record.change_amount)));
    setEditDamageNotes(record.notes || '');
  };

  const openEditWaste = (record: WasteRecord) => {
    setEditWasteDialog(record);
    setEditWasteQty(String(Math.abs(record.change_amount)));
    setEditWasteNotes(record.notes || '');
  };

  // Stats
  const totalDamageCost = damageHistory.reduce((sum, d) => sum + Math.abs(d.change_amount) * (d.products?.cost_price || 0), 0);
  const totalWasteCost = wasteHistory.reduce((sum, w) => sum + Math.abs(w.change_amount) * (w.raw_materials?.cost_per_unit || 0), 0);

  const filteredDamage = damageHistory.filter(d =>
    !search || d.products?.name?.toLowerCase().includes(search.toLowerCase()) || d.notes?.toLowerCase().includes(search.toLowerCase())
  );
  const filteredWaste = wasteHistory.filter(w =>
    !search || w.raw_materials?.name?.toLowerCase().includes(search.toLowerCase()) || w.notes?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Damage Records</p><p className="text-2xl font-bold">{damageHistory.length}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Damage Cost</p><p className="text-2xl font-bold text-destructive">{formatCurrency(totalDamageCost)}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Waste Records</p><p className="text-2xl font-bold">{wasteHistory.length}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-muted-foreground">Waste Cost</p><p className="text-2xl font-bold text-destructive">{formatCurrency(totalWasteCost)}</p></CardContent></Card>
      </div>

      {/* Actions & Search */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search records..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-2">
          <Button variant="destructive" onClick={() => setDamageDialogOpen(true)}>
            <Package className="h-4 w-4 mr-2" />Record Damage
          </Button>
          <Button variant="outline" className="border-destructive text-destructive hover:bg-destructive/10" onClick={() => setWasteDialogOpen(true)}>
            <Beaker className="h-4 w-4 mr-2" />Record Waste
          </Button>
        </div>
      </div>

      {/* Tabs for Damage vs Waste */}
      <Tabs defaultValue="damage" className="space-y-4">
        <TabsList>
          <TabsTrigger value="damage" className="gap-2"><Package className="h-4 w-4" />Finished Goods Damage ({filteredDamage.length})</TabsTrigger>
          <TabsTrigger value="waste" className="gap-2"><Beaker className="h-4 w-4" />Raw Material Waste ({filteredWaste.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="damage">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="text-right">Cost Impact</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Recorded By</TableHead>
                  {(canEdit || canDelete) && <TableHead className="w-[100px]">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {damageLoading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                ) : filteredDamage.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No damage records found</TableCell></TableRow>
                ) : (
                  filteredDamage.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="text-sm whitespace-nowrap">{format(new Date(record.created_at), 'MMM d, yyyy HH:mm')}</TableCell>
                      <TableCell className="font-medium">{record.products?.name || 'Unknown'}</TableCell>
                      <TableCell className="text-right text-destructive font-semibold">{Math.abs(record.change_amount)}</TableCell>
                      <TableCell className="text-right text-destructive">{formatCurrency(Math.abs(record.change_amount) * (record.products?.cost_price || 0))}</TableCell>
                      <TableCell className="max-w-[200px] truncate text-muted-foreground text-sm">{record.notes || '—'}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap">{record.changed_by_user?.full_name || record.changed_by_user?.email || 'Unknown'}</TableCell>
                      {(canEdit || canDelete) && (
                        <TableCell>
                          <div className="flex gap-1">
                            {canEdit && (
                              <Button variant="ghost" size="icon" onClick={() => openEditDamage(record)}><Pencil className="h-4 w-4" /></Button>
                            )}
                            {canDelete && (
                              <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setDeleteDamageRecord(record)}><Trash2 className="h-4 w-4" /></Button>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        <TabsContent value="waste">
          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Material</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="text-right">Cost Impact</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Recorded By</TableHead>
                  {(canEdit || canDelete) && <TableHead className="w-[100px]">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {wasteLoading ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                ) : filteredWaste.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No waste records found</TableCell></TableRow>
                ) : (
                  filteredWaste.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell className="text-sm whitespace-nowrap">{format(new Date(record.created_at), 'MMM d, yyyy HH:mm')}</TableCell>
                      <TableCell className="font-medium">{record.raw_materials?.name || 'Unknown'}</TableCell>
                      <TableCell className="text-right text-destructive font-semibold">{Math.abs(record.change_amount)}</TableCell>
                      <TableCell className="text-right text-destructive">{formatCurrency(Math.abs(record.change_amount) * (record.raw_materials?.cost_per_unit || 0))}</TableCell>
                      <TableCell className="max-w-[200px] truncate text-muted-foreground text-sm">{record.notes || '—'}</TableCell>
                      <TableCell className="text-sm whitespace-nowrap">{record.changed_by_user?.full_name || record.changed_by_user?.email || 'Unknown'}</TableCell>
                      {(canEdit || canDelete) && (
                        <TableCell>
                          <div className="flex gap-1">
                            {canEdit && (
                              <Button variant="ghost" size="icon" onClick={() => openEditWaste(record)}><Pencil className="h-4 w-4" /></Button>
                            )}
                            {canDelete && (
                              <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setDeleteWasteRecord(record)}><Trash2 className="h-4 w-4" /></Button>
                            )}
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Record Damage Dialog */}
      <Dialog open={damageDialogOpen} onOpenChange={(open) => { setDamageDialogOpen(open); if (!open) { setSelectedProductId(''); setDamageQty(''); setDamageNotes(''); } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Record Finished Goods Damage</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Product *</Label>
              <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                <SelectTrigger><SelectValue placeholder="Select product" /></SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name} (Stock: {Number(p.current_stock)})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedProduct && (
              <div className="text-sm text-muted-foreground p-3 rounded-md bg-muted">
                <p>Current Stock: <span className="font-semibold text-foreground">{Number(selectedProduct.current_stock)}</span></p>
                <p>Value per unit: <span className="font-semibold text-foreground">{formatCurrency(selectedProduct.cost_price)}</span></p>
              </div>
            )}
            <div className="space-y-2">
              <Label>Damaged Quantity *</Label>
              <Input type="number" min="1" max={selectedProduct ? Number(selectedProduct.current_stock) : undefined} value={damageQty} onChange={(e) => setDamageQty(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Reason / Notes</Label>
              <Textarea value={damageNotes} onChange={(e) => setDamageNotes(e.target.value)} rows={2} placeholder="e.g. Broken during handling..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDamageDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleRecordDamage} disabled={!selectedProductId || !damageQty || Number(damageQty) <= 0}>Record Damage</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Record Waste Dialog */}
      <Dialog open={wasteDialogOpen} onOpenChange={(open) => { setWasteDialogOpen(open); if (!open) { setSelectedMaterialId(''); setWasteQty(''); setWasteNotes(''); } }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Record Raw Material Waste</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Raw Material *</Label>
              <Select value={selectedMaterialId} onValueChange={setSelectedMaterialId}>
                <SelectTrigger><SelectValue placeholder="Select material" /></SelectTrigger>
                <SelectContent>
                  {materials.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.name} (Stock: {Number(m.current_stock)})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedMaterial && (
              <div className="text-sm text-muted-foreground p-3 rounded-md bg-muted">
                <p>Current Stock: <span className="font-semibold text-foreground">{Number(selectedMaterial.current_stock)}</span></p>
                <p>Cost per unit: <span className="font-semibold text-foreground">{formatCurrency(selectedMaterial.cost_per_unit)}</span></p>
              </div>
            )}
            <div className="space-y-2">
              <Label>Waste Quantity *</Label>
              <Input type="number" min="1" max={selectedMaterial ? Number(selectedMaterial.current_stock) : undefined} value={wasteQty} onChange={(e) => setWasteQty(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Reason / Notes</Label>
              <Textarea value={wasteNotes} onChange={(e) => setWasteNotes(e.target.value)} rows={2} placeholder="e.g. Expired, contaminated..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWasteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleRecordWaste} disabled={!selectedMaterialId || !wasteQty || Number(wasteQty) <= 0}>Record Waste</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Damage Dialog */}
      <Dialog open={!!editDamageDialog} onOpenChange={(open) => { if (!open) setEditDamageDialog(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Edit Damage Record</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground p-3 rounded-md bg-muted">
              <p>Product: <span className="font-semibold text-foreground">{editDamageDialog?.products?.name}</span></p>
              <p>Original quantity: <span className="font-semibold text-foreground">{editDamageDialog ? Math.abs(editDamageDialog.change_amount) : 0}</span></p>
            </div>
            <div className="space-y-2">
              <Label>Updated Quantity *</Label>
              <Input type="number" min="1" value={editDamageQty} onChange={(e) => setEditDamageQty(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={editDamageNotes} onChange={(e) => setEditDamageNotes(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDamageDialog(null)}>Cancel</Button>
            <Button onClick={handleEditDamage} disabled={!editDamageQty || Number(editDamageQty) <= 0}>Update</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Waste Dialog */}
      <Dialog open={!!editWasteDialog} onOpenChange={(open) => { if (!open) setEditWasteDialog(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Edit Waste Record</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground p-3 rounded-md bg-muted">
              <p>Material: <span className="font-semibold text-foreground">{editWasteDialog?.raw_materials?.name}</span></p>
              <p>Original quantity: <span className="font-semibold text-foreground">{editWasteDialog ? Math.abs(editWasteDialog.change_amount) : 0}</span></p>
            </div>
            <div className="space-y-2">
              <Label>Updated Quantity *</Label>
              <Input type="number" min="1" value={editWasteQty} onChange={(e) => setEditWasteQty(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={editWasteNotes} onChange={(e) => setEditWasteNotes(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditWasteDialog(null)}>Cancel</Button>
            <Button onClick={handleEditWaste} disabled={!editWasteQty || Number(editWasteQty) <= 0}>Update</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Damage Confirmation */}
      <AlertDialog open={!!deleteDamageRecord} onOpenChange={(open) => !open && setDeleteDamageRecord(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Damage Record?</AlertDialogTitle>
            <AlertDialogDescription>
              This will restore {deleteDamageRecord ? Math.abs(deleteDamageRecord.change_amount) : 0} units back to {deleteDamageRecord?.products?.name} stock. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteDamage} className="bg-destructive text-destructive-foreground">Delete & Restore Stock</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Waste Confirmation */}
      <AlertDialog open={!!deleteWasteRecord} onOpenChange={(open) => !open && setDeleteWasteRecord(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Waste Record?</AlertDialogTitle>
            <AlertDialogDescription>
              This will restore {deleteWasteRecord ? Math.abs(deleteWasteRecord.change_amount) : 0} units back to {deleteWasteRecord?.raw_materials?.name} stock. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteWaste} className="bg-destructive text-destructive-foreground">Delete & Restore Stock</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
