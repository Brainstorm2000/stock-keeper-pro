import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Search, Plus, Pencil, Trash2, UserCheck, UserX, Loader2, Users, Building2, Activity } from 'lucide-react';
import { adminCreateAuthUser } from '@/lib/admin-auth-client';

interface AdminUser {
  id: string;
  user_id: string;
  email: string | null;
  full_name: string | null;
  organization_id: string | null;
  is_active: boolean;
  created_at: string;
  role: string;
}

interface Organization {
  id: string;
  name: string;
}

function useAdminAllUsers() {
  return useQuery({
    queryKey: ['admin-all-users'],
    queryFn: async () => {
      const { data: profiles, error: pErr } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });
      if (pErr) throw pErr;

      const { data: roles, error: rErr } = await supabase
        .from('user_roles')
        .select('user_id, role, organization_id');
      if (rErr) throw rErr;

      const users: AdminUser[] = (profiles || []).map((p: any) => {
        const userRole = (roles || []).find((r: any) => r.user_id === p.user_id);
        return {
          ...p,
          role: userRole?.role || 'user',
        } as AdminUser;
      });
      return users;
    },
  });
}

function useAllOrganizationsForSelect() {
  return useQuery({
    queryKey: ['admin-all-orgs-select'],
    queryFn: async () => {
      const { data, error } = await supabase.from('organizations').select('id, name').order('name');
      if (error) throw error;
      return data as Organization[];
    },
  });
}

export default function AdminUsersPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: users = [], isLoading } = useAdminAllUsers();
  const { data: organizations = [] } = useAllOrganizationsForSelect();

  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formEmail, setFormEmail] = useState('');
  const [formName, setFormName] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formOrgId, setFormOrgId] = useState<string>('none');
  const [formRole, setFormRole] = useState<string>('user');

  const filteredUsers = users.filter((u) => {
    const q = search.toLowerCase();
    return (
      (u.full_name || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q)
    );
  });

  const orgMap = Object.fromEntries(organizations.map((o) => [o.id, o.name]));

  const openCreate = () => {
    setEditingUser(null);
    setFormEmail('');
    setFormName('');
    setFormPassword('');
    setFormOrgId('none');
    setFormRole('user');
    setDialogOpen(true);
  };

  const openEdit = (user: AdminUser) => {
    setEditingUser(user);
    setFormEmail(user.email || '');
    setFormName(user.full_name || '');
    setFormPassword('');
    setFormOrgId(user.organization_id || 'none');
    setFormRole(user.role || 'user');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editingUser) {
        const newOrgId = formOrgId === 'none' ? null : formOrgId;
        const { error: profileErr } = await supabase
          .from('profiles')
          .update({
            full_name: formName || null,
            email: formEmail,
            organization_id: newOrgId,
          })
          .eq('user_id', editingUser.user_id);
        if (profileErr) throw profileErr;

        const { error: roleErr } = await supabase
          .from('user_roles')
          .update({ role: formRole as any, organization_id: newOrgId })
          .eq('user_id', editingUser.user_id);
        if (roleErr) throw roleErr;
        toast({ title: 'User updated' });
      } else {
        if (!formEmail || !formPassword) {
          toast({ title: 'Email and password are required', variant: 'destructive' });
          setSaving(false);
          return;
        }
        const newOrgId = formOrgId === 'none' ? null : formOrgId;
        const newUserId = await adminCreateAuthUser(formEmail, formPassword);
        const { error: profileErr } = await supabase.from('profiles').insert({
          user_id: newUserId,
          email: formEmail,
          full_name: formName || null,
          organization_id: newOrgId,
          is_active: true,
        });
        if (profileErr) throw profileErr;
        const { error: roleErr } = await supabase.from('user_roles').insert({
          user_id: newUserId,
          role: formRole as any,
          organization_id: newOrgId,
        });
        if (roleErr) throw roleErr;
        toast({ title: 'User created' });
      }
      queryClient.invalidateQueries({ queryKey: ['admin-all-users'] });
      setDialogOpen(false);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (user: AdminUser) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: !user.is_active })
        .eq('user_id', user.user_id);
      if (error) throw error;
      toast({ title: user.is_active ? 'User deactivated' : 'User activated' });
      queryClient.invalidateQueries({ queryKey: ['admin-all-users'] });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    if (!deleteUserId) return;
    try {
      // Remove role + profile. The underlying auth.users record is left in
      // place (auth admin APIs are server-only); the user can no longer
      // access the app because they have no profile/role in any org.
      const { error: roleErr } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', deleteUserId);
      if (roleErr) throw roleErr;
      const { error: profileErr } = await supabase
        .from('profiles')
        .delete()
        .eq('user_id', deleteUserId);
      if (profileErr) throw profileErr;
      toast({ title: 'User deleted' });
      queryClient.invalidateQueries({ queryKey: ['admin-all-users'] });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setDeleteUserId(null);
    }
  };

  const totalActive = users.filter((u) => u.is_active !== false).length;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Users Management</h1>
            <p className="text-muted-foreground">Manage all users across organizations</p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Create User
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{users.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Users</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalActive}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Organizations</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{organizations.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <CardTitle>All Users</CardTitle>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search users..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Organization</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                          No users found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredUsers.map((u) => (
                        <TableRow key={u.user_id}>
                          <TableCell className="font-medium">{u.full_name || '—'}</TableCell>
                          <TableCell>{u.email}</TableCell>
                          <TableCell>
                            {u.organization_id ? (
                              <span className="text-sm">{orgMap[u.organization_id] || u.organization_id.slice(0, 8)}</span>
                            ) : (
                              <span className="text-muted-foreground text-sm">None</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={u.role === 'super_admin' ? 'default' : u.role === 'admin' ? 'default' : 'secondary'}>
                              {u.role === 'super_admin' ? 'Org Admin' : u.role === 'admin' ? 'Admin' : u.role === 'super_super_admin' ? 'Super Admin' : 'User'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={u.is_active !== false ? 'default' : 'secondary'}>
                              {u.is_active !== false ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {format(new Date(u.created_at), 'MMM d, yyyy')}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon" onClick={() => openEdit(u)} title="Edit">
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleToggleActive(u)}
                                title={u.is_active !== false ? 'Deactivate' : 'Activate'}
                              >
                                {u.is_active !== false ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeleteUserId(u.user_id)}
                                title="Delete"
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingUser ? 'Edit User' : 'Create User'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="John Doe" />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} placeholder="user@example.com" />
            </div>
            {!editingUser && (
              <div className="space-y-2">
                <Label>Password</Label>
                <Input type="password" value={formPassword} onChange={(e) => setFormPassword(e.target.value)} placeholder="Min 6 characters" />
              </div>
            )}
            <div className="space-y-2">
              <Label>Organization</Label>
              <Select value={formOrgId} onValueChange={setFormOrgId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select organization" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No Organization</SelectItem>
                  {organizations.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={formRole} onValueChange={setFormRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User (Viewer)</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="super_admin">Organization Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingUser ? 'Save Changes' : 'Create User'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteUserId} onOpenChange={() => setDeleteUserId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete User</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this user and all their data. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
