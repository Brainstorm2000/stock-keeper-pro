import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Search, Trash2, Pencil, Loader2, Table2, ArrowLeft, BarChart3,
  List, Settings2, ChevronRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ModuleAccessGuard, useModuleAccess } from '@/components/access/ModuleAccessGuard';
import { useOrganization } from '@/hooks/useOrganization';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/currency';
import { format } from 'date-fns';
import {
  useProductionTables,
  useProductionFields,
  useProductionRecords,
  useCreateProductionTable,
  useUpdateProductionTable,
  useDeleteProductionTable,
  useCreateProductionField,
  useUpdateProductionField,
  useDeleteProductionField,
  useCreateProductionRecord,
  useDeleteProductionRecord,
  type ProductionTable as ProdTable,
  type ProductionField,
} from '@/hooks/useProduction';
import { ProductionTableDashboard } from '@/components/production/ProductionTableDashboard';

const FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'currency', label: 'Currency' },
  { value: 'date', label: 'Date' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'select', label: 'Select (Dropdown)' },
];

export default function Production() {
  const { user, loading: authLoading, isAdmin, hasCompletedOnboarding } = useAuth();
  const { canCreate, canEdit, canDelete } = useModuleAccess('production');
  const { data: organization } = useOrganization();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('records');

  // Table CRUD state
  const [tableDialogOpen, setTableDialogOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<ProdTable | null>(null);
  const [tableName, setTableName] = useState('');
  const [tableDescription, setTableDescription] = useState('');
  const [deleteTableId, setDeleteTableId] = useState<string | null>(null);

  // Field CRUD state
  const [fieldDialogOpen, setFieldDialogOpen] = useState(false);
  const [editingField, setEditingField] = useState<ProductionField | null>(null);
  const [fieldName, setFieldName] = useState('');
  const [fieldType, setFieldType] = useState('text');
  const [fieldRequired, setFieldRequired] = useState(false);
  const [fieldOptions, setFieldOptions] = useState('');
  const [deleteFieldId, setDeleteFieldId] = useState<string | null>(null);

  // Record state
  const [recordDialogOpen, setRecordDialogOpen] = useState(false);
  const [recordValues, setRecordValues] = useState<Record<string, string>>({});
  const [deleteRecordId, setDeleteRecordId] = useState<string | null>(null);

  const { data: tables = [], isLoading: tablesLoading } = useProductionTables();
  const { data: fields = [], isLoading: fieldsLoading } = useProductionFields(selectedTableId);
  const { data: records = [], isLoading: recordsLoading } = useProductionRecords(selectedTableId);

  const createTable = useCreateProductionTable();
  const updateTable = useUpdateProductionTable();
  const deleteTable = useDeleteProductionTable();
  const createField = useCreateProductionField();
  const updateField = useUpdateProductionField();
  const deleteField = useDeleteProductionField();
  const createRecord = useCreateProductionRecord();
  const deleteRecord = useDeleteProductionRecord();

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
    else if (!authLoading && user && hasCompletedOnboarding === false) navigate('/onboarding');
  }, [user, authLoading, hasCompletedOnboarding, navigate]);

  const selectedTable = tables.find(t => t.id === selectedTableId);

  // --- Table CRUD handlers ---
  const resetTableForm = () => { setTableName(''); setTableDescription(''); setEditingTable(null); };
  const openEditTable = (t: ProdTable) => { setEditingTable(t); setTableName(t.name); setTableDescription(t.description || ''); setTableDialogOpen(true); };

  const handleSaveTable = async () => {
    if (!tableName.trim()) { toast({ title: 'Name is required', variant: 'destructive' }); return; }
    if (editingTable) {
      await updateTable.mutateAsync({ id: editingTable.id, name: tableName, description: tableDescription || undefined });
    } else {
      if (!organization?.id) return;
      await createTable.mutateAsync({ organization_id: organization.id, name: tableName, description: tableDescription || undefined });
    }
    setTableDialogOpen(false);
    resetTableForm();
  };

  const confirmDeleteTable = async () => {
    if (!deleteTableId) return;
    await deleteTable.mutateAsync(deleteTableId);
    if (selectedTableId === deleteTableId) setSelectedTableId(null);
    setDeleteTableId(null);
  };

  // --- Field CRUD handlers ---
  const resetFieldForm = () => { setFieldName(''); setFieldType('text'); setFieldRequired(false); setFieldOptions(''); setEditingField(null); };
  const openEditField = (f: ProductionField) => { setEditingField(f); setFieldName(f.name); setFieldType(f.type); setFieldRequired(f.required); setFieldOptions(f.options?.join(', ') || ''); setFieldDialogOpen(true); };

  const handleSaveField = async () => {
    if (!fieldName.trim() || !selectedTableId) { toast({ title: 'Name is required', variant: 'destructive' }); return; }
    const options = fieldType === 'select' ? fieldOptions.split(',').map(o => o.trim()).filter(Boolean) : [];
    if (editingField) {
      await updateField.mutateAsync({ id: editingField.id, tableId: selectedTableId, name: fieldName, type: fieldType, required: fieldRequired, options });
    } else {
      await createField.mutateAsync({ table_id: selectedTableId, name: fieldName, type: fieldType, required: fieldRequired, options, sort_order: fields.length });
    }
    setFieldDialogOpen(false);
    resetFieldForm();
  };

  const confirmDeleteField = async () => {
    if (!deleteFieldId || !selectedTableId) return;
    await deleteField.mutateAsync({ id: deleteFieldId, tableId: selectedTableId });
    setDeleteFieldId(null);
  };

  // --- Record CRUD handlers ---
  const openAddRecord = () => {
    const vals: Record<string, string> = {};
    fields.forEach(f => { vals[f.id] = f.type === 'boolean' ? 'false' : ''; });
    setRecordValues(vals);
    setRecordDialogOpen(true);
  };

  const handleSaveRecord = async () => {
    if (!selectedTableId) return;
    // Validate required fields
    for (const f of fields) {
      if (f.required && (!recordValues[f.id] || recordValues[f.id].trim() === '')) {
        toast({ title: `${f.name} is required`, variant: 'destructive' });
        return;
      }
    }
    const values = fields.map(f => ({ field_id: f.id, value: recordValues[f.id] || null }));
    await createRecord.mutateAsync({ tableId: selectedTableId, values });
    setRecordDialogOpen(false);
  };

  const confirmDeleteRecord = async () => {
    if (!deleteRecordId || !selectedTableId) return;
    await deleteRecord.mutateAsync({ id: deleteRecordId, tableId: selectedTableId });
    setDeleteRecordId(null);
  };

  // Render value for display
  const renderValue = (field: ProductionField, value: string | null | undefined) => {
    if (value === null || value === undefined || value === '') return <span className="text-muted-foreground">—</span>;
    switch (field.type) {
      case 'currency': return formatCurrency(parseFloat(value) || 0);
      case 'number': return Number(value).toLocaleString();
      case 'date': try { return format(new Date(value), 'MMM dd, yyyy'); } catch { return value; }
      case 'boolean': return <Badge variant={value === 'true' ? 'default' : 'secondary'}>{value === 'true' ? 'Yes' : 'No'}</Badge>;
      default: return value;
    }
  };

  if (authLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <DashboardLayout>
      <ModuleAccessGuard module="production">
        <div className="space-y-6">
          {!selectedTableId ? (
            // --- Table List View ---
            <>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h1 className="text-2xl font-bold text-foreground">Production</h1>
                  <p className="text-muted-foreground">Create and manage custom production tables</p>
                </div>
                {canCreate && (
                  <Button onClick={() => { resetTableForm(); setTableDialogOpen(true); }}>
                    <Plus className="mr-2 h-4 w-4" /> New Table
                  </Button>
                )}
              </div>

              {tablesLoading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
              ) : tables.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <Table2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-lg font-medium">No production tables yet</p>
                    <p className="text-muted-foreground mb-4">Create your first table to start tracking production data</p>
                    {canCreate && (
                      <Button onClick={() => { resetTableForm(); setTableDialogOpen(true); }}>
                        <Plus className="mr-2 h-4 w-4" /> Create Table
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                  {tables.map(t => (
                    <Card key={t.id} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => setSelectedTableId(t.id)}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">{t.name}</CardTitle>
                          <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        </div>
                        {t.description && <CardDescription>{t.description}</CardDescription>}
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground">
                          Created {format(new Date(t.created_at), 'MMM dd, yyyy')}
                        </p>
                        {canEdit && (
                          <div className="flex gap-1 mt-2" onClick={e => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" onClick={() => openEditTable(t)}><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => setDeleteTableId(t.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </>
          ) : (
            // --- Table Detail View ---
            <>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <Button variant="ghost" size="icon" onClick={() => setSelectedTableId(null)}>
                    <ArrowLeft className="h-5 w-5" />
                  </Button>
                  <div>
                    <h1 className="text-2xl font-bold text-foreground">{selectedTable?.name}</h1>
                    {selectedTable?.description && <p className="text-muted-foreground">{selectedTable.description}</p>}
                  </div>
                </div>
                <div className="flex gap-2">
                  {canCreate && (
                    <Button variant="outline" onClick={() => { resetFieldForm(); setFieldDialogOpen(true); }}>
                      <Settings2 className="mr-2 h-4 w-4" /> Add Field
                    </Button>
                  )}
                  {canCreate && fields.length > 0 && (
                    <Button onClick={openAddRecord}>
                      <Plus className="mr-2 h-4 w-4" /> Add Record
                    </Button>
                  )}
                </div>
              </div>

              <Tabs value={activeTab} onValueChange={setActiveTab}>
                <TabsList>
                  <TabsTrigger value="records" className="gap-2"><List className="h-4 w-4" /> Records</TabsTrigger>
                  <TabsTrigger value="dashboard" className="gap-2"><BarChart3 className="h-4 w-4" /> Dashboard</TabsTrigger>
                  <TabsTrigger value="fields" className="gap-2"><Settings2 className="h-4 w-4" /> Fields</TabsTrigger>
                </TabsList>

                <TabsContent value="records" className="space-y-4">
                  {fieldsLoading || recordsLoading ? (
                    <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                  ) : fields.length === 0 ? (
                    <Card>
                      <CardContent className="py-8 text-center text-muted-foreground">
                        No fields defined yet. Add fields to start creating records.
                      </CardContent>
                    </Card>
                  ) : (
                    <Card>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[50px]">#</TableHead>
                            {fields.map(f => <TableHead key={f.id}>{f.name}</TableHead>)}
                            <TableHead>Date</TableHead>
                            {canDelete && <TableHead className="w-[60px]" />}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {records.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={fields.length + 3} className="text-center py-8 text-muted-foreground">
                                No records yet
                              </TableCell>
                            </TableRow>
                          ) : (
                            records.map((rec, idx) => (
                              <TableRow key={rec.id}>
                                <TableCell className="text-muted-foreground">{records.length - idx}</TableCell>
                                {fields.map(f => {
                                  const val = rec.values.find((v: any) => v.field_id === f.id);
                                  return <TableCell key={f.id}>{renderValue(f, val?.value)}</TableCell>;
                                })}
                                <TableCell className="text-muted-foreground text-sm">{format(new Date(rec.created_at), 'MMM dd, yyyy')}</TableCell>
                                {canDelete && (
                                  <TableCell>
                                    <Button variant="ghost" size="icon" onClick={() => setDeleteRecordId(rec.id)}>
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </TableCell>
                                )}
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </Card>
                  )}
                </TabsContent>

                <TabsContent value="dashboard">
                  <ProductionTableDashboard fields={fields} records={records} />
                </TabsContent>

                <TabsContent value="fields" className="space-y-4">
                  <Card>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Required</TableHead>
                          <TableHead>Options</TableHead>
                          {canEdit && <TableHead className="w-[100px]" />}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {fields.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No fields yet</TableCell>
                          </TableRow>
                        ) : (
                          fields.map(f => (
                            <TableRow key={f.id}>
                              <TableCell className="font-medium">{f.name}</TableCell>
                              <TableCell><Badge variant="outline">{f.type}</Badge></TableCell>
                              <TableCell>{f.required ? 'Yes' : 'No'}</TableCell>
                              <TableCell>{f.type === 'select' ? f.options?.join(', ') : '—'}</TableCell>
                              {canEdit && (
                                <TableCell>
                                  <div className="flex gap-1">
                                    <Button variant="ghost" size="icon" onClick={() => openEditField(f)}><Pencil className="h-4 w-4" /></Button>
                                    <Button variant="ghost" size="icon" onClick={() => setDeleteFieldId(f.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
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
            </>
          )}
        </div>

        {/* Table Dialog */}
        <Dialog open={tableDialogOpen} onOpenChange={o => { setTableDialogOpen(o); if (!o) resetTableForm(); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>{editingTable ? 'Edit Table' : 'New Production Table'}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><Label>Name *</Label><Input value={tableName} onChange={e => setTableName(e.target.value)} placeholder="e.g., Daily Output" /></div>
              <div className="space-y-2"><Label>Description</Label><Input value={tableDescription} onChange={e => setTableDescription(e.target.value)} placeholder="Optional description" /></div>
            </div>
            <DialogFooter><Button onClick={handleSaveTable} disabled={createTable.isPending || updateTable.isPending}>{(createTable.isPending || updateTable.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editingTable ? 'Update' : 'Create'}</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Field Dialog */}
        <Dialog open={fieldDialogOpen} onOpenChange={o => { setFieldDialogOpen(o); if (!o) resetFieldForm(); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader><DialogTitle>{editingField ? 'Edit Field' : 'Add Field'}</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><Label>Name *</Label><Input value={fieldName} onChange={e => setFieldName(e.target.value)} placeholder="e.g., Quantity" /></div>
              <div className="space-y-2">
                <Label>Type *</Label>
                <Select value={fieldType} onValueChange={setFieldType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{FIELD_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {fieldType === 'select' && (
                <div className="space-y-2"><Label>Options (comma-separated)</Label><Input value={fieldOptions} onChange={e => setFieldOptions(e.target.value)} placeholder="Option 1, Option 2, Option 3" /></div>
              )}
              <div className="flex items-center gap-2">
                <Checkbox id="field-required" checked={fieldRequired} onCheckedChange={c => setFieldRequired(!!c)} />
                <Label htmlFor="field-required">Required</Label>
              </div>
            </div>
            <DialogFooter><Button onClick={handleSaveField} disabled={createField.isPending || updateField.isPending}>{(createField.isPending || updateField.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editingField ? 'Update' : 'Add'}</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Record Dialog */}
        <Dialog open={recordDialogOpen} onOpenChange={setRecordDialogOpen}>
          <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Add Record</DialogTitle></DialogHeader>
            <div className="space-y-4">
              {fields.map(f => (
                <div key={f.id} className="space-y-2">
                  <Label>{f.name}{f.required && ' *'}</Label>
                  {f.type === 'text' && (
                    <Input value={recordValues[f.id] || ''} onChange={e => setRecordValues(v => ({ ...v, [f.id]: e.target.value }))} />
                  )}
                  {(f.type === 'number' || f.type === 'currency') && (
                    <Input type="number" step={f.type === 'currency' ? '0.01' : '1'} value={recordValues[f.id] || ''} onChange={e => setRecordValues(v => ({ ...v, [f.id]: e.target.value }))} />
                  )}
                  {f.type === 'date' && (
                    <Input type="date" value={recordValues[f.id] || ''} onChange={e => setRecordValues(v => ({ ...v, [f.id]: e.target.value }))} />
                  )}
                  {f.type === 'boolean' && (
                    <div className="flex items-center gap-2">
                      <Checkbox checked={recordValues[f.id] === 'true'} onCheckedChange={c => setRecordValues(v => ({ ...v, [f.id]: String(!!c) }))} />
                      <span className="text-sm">{recordValues[f.id] === 'true' ? 'Yes' : 'No'}</span>
                    </div>
                  )}
                  {f.type === 'select' && (
                    <Select value={recordValues[f.id] || ''} onValueChange={val => setRecordValues(v => ({ ...v, [f.id]: val }))}>
                      <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                      <SelectContent>{f.options?.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
                    </Select>
                  )}
                </div>
              ))}
            </div>
            <DialogFooter><Button onClick={handleSaveRecord} disabled={createRecord.isPending}>{createRecord.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save Record</Button></DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmations */}
        <AlertDialog open={!!deleteTableId} onOpenChange={() => setDeleteTableId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>Delete Table?</AlertDialogTitle><AlertDialogDescription>This will permanently delete this table and all its fields, records, and data.</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={confirmDeleteTable} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={!!deleteFieldId} onOpenChange={() => setDeleteFieldId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>Delete Field?</AlertDialogTitle><AlertDialogDescription>This will remove this field and all its data from existing records.</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={confirmDeleteField} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog open={!!deleteRecordId} onOpenChange={() => setDeleteRecordId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>Delete Record?</AlertDialogTitle><AlertDialogDescription>This will permanently delete this record.</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={confirmDeleteRecord} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </ModuleAccessGuard>
    </DashboardLayout>
  );
}
