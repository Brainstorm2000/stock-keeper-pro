import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { format, differenceInDays } from 'date-fns';
import { Search, Plus, Pencil, Trash2, Loader2, Building2, Activity, Users, Eye, Clock, Settings2 } from 'lucide-react';
import { OrgModulesDialog } from '@/components/organizations/OrgModulesDialog';

interface Organization {
  id: string;
  name: string;
  slug: string;
  email: string | null;
  address: string | null;
  logo_url: string | null;
  is_active: boolean;
  created_at: string;
}

function useAllOrganizations() {
  return useQuery({
    queryKey: ['admin-all-organizations'],
    queryFn: async () => {
      const { data, error } = await supabase.from('organizations').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data as Organization[];
    },
  });
}

function useOrgUserCounts() {
  return useQuery({
    queryKey: ['admin-org-user-counts'],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('organization_id');
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data || []).forEach((p) => {
        if (p.organization_id) {
          counts[p.organization_id] = (counts[p.organization_id] || 0) + 1;
        }
      });
      return counts;
    },
  });
}

function useOrgBranchCounts() {
  return useQuery({
    queryKey: ['admin-org-branch-counts'],
    queryFn: async () => {
      const { data, error } = await supabase.from('branches').select('organization_id');
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data || []).forEach((b: any) => {
        if (b.organization_id) {
          counts[b.organization_id] = (counts[b.organization_id] || 0) + 1;
        }
      });
      return counts;
    },
  });
}

interface OrgSubscription {
  id: string;
  organization_id: string;
  status: string;
  plan_id: string | null;
  trial_end_date: string | null;
  subscription_end_date: string | null;
}

function useOrgSubscriptions() {
  return useQuery({
    queryKey: ['admin-org-subscriptions'],
    queryFn: async () => {
      const { data, error } = await supabase.from('organization_subscriptions').select('id, organization_id, status, plan_id, trial_end_date, subscription_end_date');
      if (error) throw error;
      return data as OrgSubscription[];
    },
  });
}

function usePricingPlansForOrgs() {
  return useQuery({
    queryKey: ['admin-pricing-plans-orgs'],
    queryFn: async () => {
      const { data, error } = await supabase.from('pricing_plans').select('id, name');
      if (error) throw error;
      return data as { id: string; name: string }[];
    },
  });
}

function useOrgUsers(orgId: string | null) {
  return useQuery({
    queryKey: ['admin-org-users', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('organization_id', orgId!);
      if (error) throw error;

      const { data: roles } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .eq('organization_id', orgId!);

      return (profiles || []).map((p) => {
        const role = (roles || []).find((r) => r.user_id === p.user_id);
        return { ...p, role: role?.role || 'user' };
      });
    },
  });
}

export default function AdminOrganizationsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: organizations = [], isLoading } = useAllOrganizations();
  const { data: userCounts = {} } = useOrgUserCounts();
  const { data: branchCounts = {} } = useOrgBranchCounts();
  const { data: orgSubscriptions = [] } = useOrgSubscriptions();
  const { data: pricingPlans = [] } = usePricingPlansForOrgs();

  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingOrg, setEditingOrg] = useState<Organization | null>(null);
  const [deleteOrgId, setDeleteOrgId] = useState<string | null>(null);
  const [viewOrgId, setViewOrgId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formActive, setFormActive] = useState(true);

  const { data: orgUsers = [], isLoading: orgUsersLoading } = useOrgUsers(viewOrgId);

  const filteredOrgs = organizations.filter(
    (org) =>
      org.name.toLowerCase().includes(search.toLowerCase()) ||
      org.slug.toLowerCase().includes(search.toLowerCase())
  );

  const subMap = Object.fromEntries(orgSubscriptions.map((s) => [s.organization_id, s]));
  const planMap = Object.fromEntries(pricingPlans.map((p) => [p.id, p.name]));

  const openCreate = () => {
    setEditingOrg(null);
    setFormName('');
    setFormSlug('');
    setFormEmail('');
    setFormAddress('');
    setFormActive(true);
    setDialogOpen(true);
  };

  const openEdit = (org: Organization) => {
    setEditingOrg(org);
    setFormName(org.name);
    setFormSlug(org.slug);
    setFormEmail(org.email || '');
    setFormAddress(org.address || '');
    setFormActive(org.is_active);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (editingOrg) {
        const { error } = await supabase
          .from('organizations')
          .update({ name: formName, email: formEmail || null, address: formAddress || null, is_active: formActive })
          .eq('id', editingOrg.id);
        if (error) throw error;
        toast({ title: 'Organization updated' });
      } else {
        if (!formName || !formSlug) {
          toast({ title: 'Name and slug are required', variant: 'destructive' });
          setSaving(false);
          return;
        }
        const { error } = await supabase
          .from('organizations')
          .insert({ name: formName, slug: formSlug, email: formEmail || null, address: formAddress || null, is_active: formActive });
        if (error) throw error;
        toast({ title: 'Organization created' });
      }
      queryClient.invalidateQueries({ queryKey: ['admin-all-organizations'] });
      setDialogOpen(false);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (org: Organization) => {
    try {
      const { error } = await supabase
        .from('organizations')
        .update({ is_active: !org.is_active })
        .eq('id', org.id);
      if (error) throw error;
      toast({ title: org.is_active ? 'Organization disabled' : 'Organization enabled' });
      queryClient.invalidateQueries({ queryKey: ['admin-all-organizations'] });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleDelete = async () => {
    if (!deleteOrgId) return;
    try {
      const { error } = await supabase.from('organizations').delete().eq('id', deleteOrgId);
      if (error) throw error;
      toast({ title: 'Organization deleted' });
      queryClient.invalidateQueries({ queryKey: ['admin-all-organizations'] });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setDeleteOrgId(null);
    }
  };

  const activeOrgs = organizations.filter((o) => o.is_active).length;
  const totalUsers = Object.values(userCounts).reduce((a, b) => a + b, 0);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Organizations</h1>
            <p className="text-muted-foreground">Manage all organizations on the platform</p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Create Organization
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Organizations</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{organizations.length}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{activeOrgs}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{totalUsers}</div></CardContent>
          </Card>
        </div>

        {/* Table */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <CardTitle>All Organizations</CardTitle>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                     <TableRow>
                      <TableHead>Organization</TableHead>
                      <TableHead>Plan</TableHead>
                      <TableHead>Sub Status</TableHead>
                      <TableHead>Days Left</TableHead>
                      <TableHead>Status</TableHead>
                       <TableHead>Users</TableHead>
                       <TableHead>Branches</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrgs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-muted-foreground py-8">No organizations found</TableCell>
                      </TableRow>
                    ) : (
                      filteredOrgs.map((org) => {
                        const sub = subMap[org.id];
                        const endDateStr = sub ? (sub.status === 'trial' ? sub.trial_end_date : sub.subscription_end_date) : null;
                        let daysLeft: number | null = null;
                        if (endDateStr) {
                          try {
                            daysLeft = differenceInDays(new Date(endDateStr), new Date());
                          } catch { daysLeft = null; }
                        }
                        const subStatusVariant = !sub ? 'outline' as const : sub.status === 'active' ? 'default' as const : sub.status === 'trial' ? 'secondary' as const : 'destructive' as const;
                        const createdDate = org.created_at ? new Date(org.created_at) : null;
                        const createdStr = createdDate && !isNaN(createdDate.getTime()) ? format(createdDate, 'MMM d, yyyy') : '—';
                        return (
                        <TableRow key={org.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              {org.logo_url ? (
                                <img src={org.logo_url} alt={org.name} className="h-8 w-8 rounded object-cover" />
                              ) : (
                                <div className="h-8 w-8 rounded bg-muted flex items-center justify-center">
                                  <Building2 className="h-4 w-4 text-muted-foreground" />
                                </div>
                              )}
                              <div>
                                <p className="font-medium">{org.name}</p>
                                <code className="text-xs text-muted-foreground">{org.slug}</code>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {sub && sub.plan_id ? (
                              <Badge variant="outline" className="text-xs">{planMap[sub.plan_id] || '—'}</Badge>
                            ) : (
                              <span className="text-muted-foreground text-xs">None</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={subStatusVariant} className="text-xs capitalize">
                              {sub ? sub.status : 'No sub'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {daysLeft !== null ? (
                              <span className={daysLeft <= 3 ? 'text-destructive font-semibold' : daysLeft <= 7 ? 'font-medium text-muted-foreground' : 'text-muted-foreground'}>
                                {daysLeft <= 0 ? 'Expired' : `${daysLeft}d`}
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={org.is_active ? 'default' : 'secondary'}>{org.is_active ? 'Active' : 'Inactive'}</Badge>
                          </TableCell>
                           <TableCell>{userCounts[org.id] || 0}</TableCell>
                           <TableCell>{branchCounts[org.id] || 0}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{createdStr}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon" onClick={() => setViewOrgId(org.id)} title="View Users">
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => openEdit(org)} title="Edit">
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleToggleActive(org)}
                                title={org.is_active ? 'Disable' : 'Enable'}
                              >
                                {org.is_active ? (
                                  <Badge variant="secondary" className="text-xs px-1.5 py-0 cursor-pointer">Disable</Badge>
                                ) : (
                                  <Badge variant="default" className="text-xs px-1.5 py-0 cursor-pointer">Enable</Badge>
                                )}
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => setDeleteOrgId(org.id)} title="Delete" className="text-destructive hover:text-destructive">
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                        );
                      })
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
            <DialogTitle>{editingOrg ? 'Edit Organization' : 'Create Organization'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="Acme Inc" />
            </div>
            {!editingOrg && (
              <div className="space-y-2">
                <Label>Slug (invite code)</Label>
                <Input value={formSlug} onChange={(e) => setFormSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))} placeholder="acme-inc" />
              </div>
            )}
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Address</Label>
              <Textarea value={formAddress} onChange={(e) => setFormAddress(e.target.value)} rows={2} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Active</Label>
              <Switch checked={formActive} onCheckedChange={setFormActive} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingOrg ? 'Save Changes' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Org Users Dialog */}
      <Dialog open={!!viewOrgId} onOpenChange={(o) => !o && setViewOrgId(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Organization Users</DialogTitle>
          </DialogHeader>
          {orgUsersLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <div className="overflow-x-auto max-h-96">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orgUsers.length === 0 ? (
                    <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-4">No users</TableCell></TableRow>
                  ) : (
                    orgUsers.map((u: any) => (
                      <TableRow key={u.user_id}>
                        <TableCell>{u.full_name || '—'}</TableCell>
                        <TableCell>{u.email}</TableCell>
                        <TableCell><Badge variant="secondary">{u.role}</Badge></TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteOrgId} onOpenChange={() => setDeleteOrgId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Organization</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete this organization and all its data.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
