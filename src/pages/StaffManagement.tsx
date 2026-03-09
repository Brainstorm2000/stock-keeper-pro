import { useState } from 'react';
import { Plus, Search, Upload, Download, UserCheck, UserX, Loader2, QrCode, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ModuleAccessGuard, useModuleAccess } from '@/components/access/ModuleAccessGuard';
import { useStaff, useDeleteStaff, type Staff } from '@/hooks/useStaff';
import { useBranches } from '@/hooks/useBranches';
import { StaffDialog } from '@/components/staff/StaffDialog';
import { StaffTasksDialog } from '@/components/staff/StaffTasksDialog';
import { StaffProfileDialog } from '@/components/staff/StaffProfileDialog';
import { StaffIDCardExport } from '@/components/staff/StaffIDCardExport';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { downloadCSV, parseGenericCSV } from '@/lib/csv-utils';
import { useCreateStaff } from '@/hooks/useStaff';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

function StaffContent() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [tasksStaff, setTasksStaff] = useState<Staff | null>(null);
  const [profileStaff, setProfileStaff] = useState<Staff | null>(null);
  const [bulkExportOpen, setBulkExportOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [branchFilter, setBranchFilter] = useState<string>('all');

  const { data: staff = [], isLoading } = useStaff();
  const { data: branches = [] } = useBranches();
  const deleteStaff = useDeleteStaff();
  const createStaff = useCreateStaff();
  const { organizationId } = useAuth();
  const { toast } = useToast();
  const { canCreate, canDelete } = useModuleAccess('staff' as any);

  const filtered = staff.filter(s => {
    const matchSearch = !search || s.full_name.toLowerCase().includes(search.toLowerCase()) ||
      s.email?.toLowerCase().includes(search.toLowerCase()) ||
      s.staff_id?.toLowerCase().includes(search.toLowerCase()) ||
      s.department?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || (statusFilter === 'active' ? s.is_active : !s.is_active);
    const matchBranch = branchFilter === 'all' || s.branch_id === branchFilter;
    return matchSearch && matchStatus && matchBranch;
  });

  const handleEdit = (s: Staff) => { setEditingStaff(s); setDialogOpen(true); };
  const handleDialogClose = (open: boolean) => { setDialogOpen(open); if (!open) setEditingStaff(null); };

  const handleExportCSV = () => {
    const headers = ['Staff ID', 'Full Name', 'Email', 'Phone', 'Role', 'Department', 'Branch', 'Employment Date', 'Status', 'Notes'];
    const rows = filtered.map(s => [
      s.staff_id || '', s.full_name, s.email || '', s.phone || '', s.role || '',
      s.department || '', s.branches?.name || '', s.employment_date || '', s.is_active ? 'Active' : 'Inactive', s.notes || '',
    ].map(v => v.includes(',') ? `"${v}"` : v));
    const content = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    downloadCSV(content, `staff-${new Date().toISOString().split('T')[0]}.csv`);
  };

  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !organizationId) return;
    try {
      const rows = await parseGenericCSV(file);
      let imported = 0;
      for (const row of rows) {
        const name = row['full_name'] || row['name'] || row['full name'];
        if (!name) continue;
        await createStaff.mutateAsync({
          full_name: name,
          staff_id: row['staff_id'] || row['staff id'] || null,
          email: row['email'] || null,
          phone: row['phone'] || row['phone_number'] || null,
          role: row['role'] || row['position'] || null,
          department: row['department'] || null,
          employment_date: row['employment_date'] || row['employment date'] || null,
          is_active: (row['status'] || '').toLowerCase() !== 'inactive',
          notes: row['notes'] || null,
        });
        imported++;
      }
      toast({ title: `${imported} staff members imported` });
    } catch (err: any) {
      toast({ title: 'Import failed', description: err.message, variant: 'destructive' });
    }
    e.target.value = '';
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Staff Management</h1>
            <p className="text-muted-foreground">Manage your organization's staff members</p>
          </div>
          {canCreate && (
            <div className="flex flex-wrap gap-2">
              <label>
                <Button variant="outline" asChild><span><Upload className="mr-2 h-4 w-4" />Import CSV</span></Button>
                <input type="file" accept=".csv" className="hidden" onChange={handleImportCSV} />
              </label>
              <Button variant="outline" onClick={handleExportCSV}><Download className="mr-2 h-4 w-4" />Export CSV</Button>
              <Button variant="outline" onClick={() => setBulkExportOpen(true)}><CreditCard className="mr-2 h-4 w-4" />ID Cards</Button>
              <Button onClick={() => setDialogOpen(true)}><Plus className="mr-2 h-4 w-4" />Add Staff</Button>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search staff..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
          {branches.length > 0 && (
            <Select value={branchFilter} onValueChange={setBranchFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Branches</SelectItem>
                {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden md:table-cell">Email</TableHead>
                  <TableHead className="hidden md:table-cell">Phone</TableHead>
                  <TableHead className="hidden lg:table-cell">Role</TableHead>
                  <TableHead className="hidden lg:table-cell">Department</TableHead>
                  <TableHead className="hidden sm:table-cell">Branch</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No staff found</TableCell></TableRow>
                ) : filtered.map(s => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-xs">{s.staff_id || '-'}</TableCell>
                    <TableCell className="font-medium">{s.full_name}</TableCell>
                    <TableCell className="hidden md:table-cell">{s.email || '-'}</TableCell>
                    <TableCell className="hidden md:table-cell">{s.phone || '-'}</TableCell>
                    <TableCell className="hidden lg:table-cell">{s.role || '-'}</TableCell>
                    <TableCell className="hidden lg:table-cell">{s.department || '-'}</TableCell>
                    <TableCell className="hidden sm:table-cell">{s.branches?.name || '-'}</TableCell>
                    <TableCell>
                      <Badge variant={s.is_active ? 'default' : 'secondary'}>
                        {s.is_active ? <><UserCheck className="h-3 w-3 mr-1" />Active</> : <><UserX className="h-3 w-3 mr-1" />Inactive</>}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setProfileStaff(s)}>
                          <QrCode className="h-3.5 w-3.5 mr-1" />Profile
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setTasksStaff(s)}>Tasks</Button>
                        {canCreate && <Button variant="ghost" size="sm" onClick={() => handleEdit(s)}>Edit</Button>}
                        {canDelete && <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setDeleteId(s.id)}>Delete</Button>}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <StaffDialog staff={editingStaff} open={dialogOpen} onOpenChange={handleDialogClose} />
      <StaffTasksDialog staff={tasksStaff} open={!!tasksStaff} onOpenChange={open => { if (!open) setTasksStaff(null); }} />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Staff Member</AlertDialogTitle>
            <AlertDialogDescription>Are you sure? This will also affect any assigned tasks.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={async () => { if (deleteId) { await deleteStaff.mutateAsync(deleteId); setDeleteId(null); } }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}

export default function StaffManagement() {
  return (
    <ModuleAccessGuard module={'staff' as any} minLevel="view">
      <StaffContent />
    </ModuleAccessGuard>
  );
}
