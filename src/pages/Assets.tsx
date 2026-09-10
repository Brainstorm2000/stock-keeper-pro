import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Loader2, Pencil, Plus, Search, Trash2, Wrench } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ModuleAccessGuard, useModuleAccess } from '@/components/access/ModuleAccessGuard';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useBranches } from '@/hooks/useBranches';
import { useStaff } from '@/hooks/useStaff';
import { ASSET_STATUSES, type Asset, type AssetCategory, type AssetInput, useAssetCategories, useAssets, useCreateAsset, useCreateAssetCategory, useDeleteAsset, useDeleteAssetCategory, useUpdateAsset, useUpdateAssetCategory } from '@/hooks/useAssets';
import { formatCurrency } from '@/lib/currency';

const emptyAsset: AssetInput = {
  tag_id: '', name: '', category: '', category_id: null, status: 'In Storage', custodian_id: null, branch_id: null,
  purchase_cost: 0, purchase_date: null, maintenance_required: false,
};

function AssetDialog({ asset, open, onOpenChange }: { asset: Asset | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const { register, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<AssetInput>({ defaultValues: emptyAsset });
  const { data: branches = [] } = useBranches();
  const { data: staff = [] } = useStaff();
  const { data: categories = [] } = useAssetCategories();
  const createAsset = useCreateAsset();
  const updateAsset = useUpdateAsset();
  const status = watch('status');
  const maintenanceRequired = watch('maintenance_required');

  useEffect(() => {
    reset(asset ? {
      tag_id: asset.tag_id, name: asset.name, category: asset.category, category_id: asset.category_id, status: asset.status,
      custodian_id: asset.custodian_id, branch_id: asset.branch_id, purchase_cost: asset.purchase_cost,
      purchase_date: asset.purchase_date, maintenance_required: asset.maintenance_required,
    } : emptyAsset);
  }, [asset, open, reset]);

  const onSubmit = async (input: AssetInput) => {
    const selectedCategory = categories.find(category => category.id === input.category_id);
    const normalized = { ...input, category: selectedCategory?.name || input.category, purchase_cost: Number(input.purchase_cost) || 0, custodian_id: input.custodian_id || null, branch_id: input.branch_id || null, purchase_date: input.purchase_date || null };
    if (asset) await updateAsset.mutateAsync({ id: asset.id, ...normalized });
    else await createAsset.mutateAsync(normalized);
    onOpenChange(false);
  };

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>{asset ? 'Edit Asset' : 'Add Asset'}</DialogTitle></DialogHeader>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2"><Label>Tag ID *</Label><Input {...register('tag_id', { required: 'Required' })} placeholder="AST-001" />{errors.tag_id && <p className="text-xs text-destructive">{errors.tag_id.message}</p>}</div>
          <div className="space-y-2"><Label>Name *</Label><Input {...register('name', { required: 'Required' })} placeholder="Laptop" />{errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}</div>
          <div className="space-y-2"><Label>Category *</Label><Select value={watch('category_id') || 'none'} onValueChange={value => { const selected = categories.find(category => category.id === value); setValue('category_id', value === 'none' ? null : value, { shouldValidate: true }); setValue('category', selected?.name || ''); }}><SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger><SelectContent><SelectItem value="none">Select category</SelectItem>{categories.map(category => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}</SelectContent></Select>{!watch('category_id') && <p className="text-xs text-destructive">Required</p>}</div>
          <div className="space-y-2"><Label>Status</Label><Select value={status} onValueChange={value => setValue('status', value as AssetInput['status'])}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{ASSET_STATUSES.map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label>Custodian</Label><Select value={watch('custodian_id') || 'none'} onValueChange={value => setValue('custodian_id', value === 'none' ? null : value)}><SelectTrigger><SelectValue placeholder="Select staff member" /></SelectTrigger><SelectContent><SelectItem value="none">Unassigned</SelectItem>{staff.filter(member => member.is_active).map(member => <SelectItem key={member.id} value={member.id}>{member.full_name}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label>Location / Transfer To</Label><Select value={watch('branch_id') || 'none'} onValueChange={value => setValue('branch_id', value === 'none' ? null : value)}><SelectTrigger><SelectValue placeholder="Select location" /></SelectTrigger><SelectContent><SelectItem value="none">No location</SelectItem>{branches.map(branch => <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>)}</SelectContent></Select></div>
          <div className="space-y-2"><Label>Purchase Cost</Label><Input type="number" min="0" step="0.01" {...register('purchase_cost', { valueAsNumber: true })} /></div>
          <div className="space-y-2"><Label>Purchase Date</Label><Input type="date" {...register('purchase_date')} /></div>
        </div>
        <div className="flex items-center gap-3"><Switch checked={maintenanceRequired} onCheckedChange={value => setValue('maintenance_required', value)} /><Label>Maintenance required</Label></div>
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit" disabled={createAsset.isPending || updateAsset.isPending}>{asset ? 'Save Changes' : 'Add Asset'}</Button></div>
      </form>
    </DialogContent>
  </Dialog>;
}

function AssetCategoriesDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { data: categories = [] } = useAssetCategories();
  const [name, setName] = useState('');
  const [editingCategory, setEditingCategory] = useState<AssetCategory | null>(null);
  const createCategory = useCreateAssetCategory();
  const updateCategory = useUpdateAssetCategory();
  const deleteCategory = useDeleteAssetCategory();

  const saveCategory = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    if (editingCategory) await updateCategory.mutateAsync({ id: editingCategory.id, name: trimmedName });
    else await createCategory.mutateAsync(trimmedName);
    setName('');
    setEditingCategory(null);
  };

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="sm:max-w-md">
      <DialogHeader><DialogTitle>Asset Categories</DialogTitle></DialogHeader>
      <div className="space-y-4">
        <div className="space-y-2"><Label>{editingCategory ? 'Edit Category' : 'New Category'}</Label><div className="flex gap-2"><Input value={name} onChange={event => setName(event.target.value)} placeholder="e.g. IT Equipment" /><Button onClick={saveCategory} disabled={!name.trim() || createCategory.isPending || updateCategory.isPending}>{editingCategory ? 'Save' : 'Add'}</Button></div></div>
        <div className="space-y-2"><Label>Existing Categories</Label>{categories.length === 0 ? <p className="text-sm text-muted-foreground">No categories yet</p> : <div className="space-y-2 max-h-56 overflow-y-auto">{categories.map(category => <div key={category.id} className="flex items-center justify-between rounded bg-muted p-2"><span>{category.name}</span><div className="flex gap-1"><Button variant="ghost" size="sm" onClick={() => { setEditingCategory(category); setName(category.name); }}><Pencil className="h-4 w-4" /></Button><Button variant="ghost" size="sm" onClick={() => deleteCategory.mutate(category.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></div></div>)}</div>}</div>
      </div>
    </DialogContent>
  </Dialog>;
}

function AssetsContent() {
  const { data: assets = [], isLoading } = useAssets();
  const { data: categories = [] } = useAssetCategories();
  const { canCreate, canEdit, canDelete } = useModuleAccess('assets');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [deleteAssetId, setDeleteAssetId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const deleteAsset = useDeleteAsset();

  const filteredAssets = useMemo(() => assets.filter(asset => {
    const query = search.toLowerCase();
    const matchesSearch = !query || [asset.tag_id, asset.name, asset.category, asset.staff?.full_name, asset.branches?.name].some(value => value?.toLowerCase().includes(query));
    return matchesSearch && (statusFilter === 'all' || asset.status === statusFilter) && (categoryFilter === 'all' || asset.category_id === categoryFilter);
  }), [assets, search, statusFilter, categoryFilter]);
  const totalValue = assets.reduce((total, asset) => total + Number(asset.purchase_cost || 0), 0);
  const openCreate = () => { setEditingAsset(null); setDialogOpen(true); };
  const openEdit = (asset: Asset) => { setEditingAsset(asset); setDialogOpen(true); };

  return <DashboardLayout><div className="space-y-6">
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"><div><h1 className="text-2xl font-bold text-foreground">Assets Register</h1><p className="text-muted-foreground">Track ownership, location, condition, and value of business assets.</p></div>{canCreate && <div className="flex gap-2"><Button variant="outline" onClick={() => setCategoryDialogOpen(true)}>Manage Categories</Button><Button onClick={openCreate}><Plus className="mr-2 h-4 w-4" />Add Asset</Button></div>}</div>
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4"><Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Assets</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{assets.length}</p></CardContent></Card><Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Asset Value</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{formatCurrency(totalValue)}</p><p className="text-xs text-muted-foreground">Purchase cost of all assets</p></CardContent></Card><Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Maintenance Flagged</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{assets.filter(asset => asset.maintenance_required).length}</p></CardContent></Card></div>
    <div className="flex flex-col sm:flex-row gap-3"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" /><Input className="pl-9" placeholder="Search tag, name, category, custodian, or location" value={search} onChange={event => setSearch(event.target.value)} /></div><Select value={categoryFilter} onValueChange={setCategoryFilter}><SelectTrigger className="w-full sm:w-[190px]"><SelectValue placeholder="All categories" /></SelectTrigger><SelectContent><SelectItem value="all">All categories</SelectItem>{categories.map(category => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}</SelectContent></Select><Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-full sm:w-[190px]"><SelectValue placeholder="All statuses" /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem>{ASSET_STATUSES.map(value => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></div>
    {isLoading ? <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div> : <div className="rounded-md border overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Tag ID</TableHead><TableHead>Asset</TableHead><TableHead>Category</TableHead><TableHead>Status</TableHead><TableHead>Custodian</TableHead><TableHead>Location</TableHead><TableHead>Cost</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader><TableBody>{filteredAssets.length === 0 ? <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No assets found</TableCell></TableRow> : filteredAssets.map(asset => <TableRow key={asset.id}><TableCell className="font-mono text-xs">{asset.tag_id}</TableCell><TableCell className="font-medium">{asset.name}</TableCell><TableCell>{asset.category}</TableCell><TableCell><Badge variant={asset.status === 'In Use' ? 'default' : asset.status === 'Disposed' || asset.status === 'Written Off' ? 'destructive' : 'secondary'}>{asset.status}</Badge></TableCell><TableCell>{asset.staff?.full_name || 'Unassigned'}</TableCell><TableCell>{asset.branches?.name || 'No location'}</TableCell><TableCell>{formatCurrency(Number(asset.purchase_cost))}</TableCell><TableCell><div className="flex gap-1">{asset.maintenance_required && <Wrench className="h-4 w-4 text-amber-600 mt-2" />} {canEdit && <Button variant="ghost" size="sm" onClick={() => openEdit(asset)}><Pencil className="h-3.5 w-3.5 mr-1" />Edit</Button>}{canDelete && <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setDeleteAssetId(asset.id)}><Trash2 className="h-3.5 w-3.5 mr-1" />Delete</Button>}</div></TableCell></TableRow>)}</TableBody></Table></div>}
    <AssetDialog asset={editingAsset} open={dialogOpen} onOpenChange={open => { setDialogOpen(open); if (!open) setEditingAsset(null); }} />
    <AssetCategoriesDialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen} />
    <AlertDialog open={!!deleteAssetId} onOpenChange={open => !open && setDeleteAssetId(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete asset?</AlertDialogTitle><AlertDialogDescription>This permanently removes the asset from the register.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={async () => { if (deleteAssetId) await deleteAsset.mutateAsync(deleteAssetId); setDeleteAssetId(null); }}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div></DashboardLayout>;
}

export default function Assets() {
  return <ModuleAccessGuard module="assets" minLevel="view"><AssetsContent /></ModuleAccessGuard>;
}
