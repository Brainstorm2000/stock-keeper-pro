import { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/currency';
import { format } from 'date-fns';
import { Search, Pencil, Loader2, DollarSign, Building2, Activity, CreditCard } from 'lucide-react';

interface Organization {
  id: string;
  name: string;
  is_active: boolean;
}

interface PricingConfig {
  id: string;
  base_plan_price: number;
  base_users_included: number;
  price_per_extra_user: number;
  base_branches_included: number;
  price_per_extra_branch: number;
}

interface PricingModule {
  id: string;
  name: string;
  monthly_price: number;
  is_enabled: boolean;
}

interface Subscription {
  id: string;
  organization_id: string;
  number_of_users: number;
  number_of_branches: number;
  monthly_price: number;
  status: string;
  created_at: string;
}

interface SubscriptionModule {
  id: string;
  subscription_id: string;
  pricing_module_id: string;
}

function useSubscriptions() {
  return useQuery({
    queryKey: ['admin-subscriptions'],
    queryFn: async () => {
      const { data, error } = await supabase.from('organization_subscriptions').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data as Subscription[];
    },
  });
}

function useSubscriptionModules() {
  return useQuery({
    queryKey: ['admin-subscription-modules'],
    queryFn: async () => {
      const { data, error } = await supabase.from('subscription_modules').select('*');
      if (error) throw error;
      return data as SubscriptionModule[];
    },
  });
}

function usePricingConfig() {
  return useQuery({
    queryKey: ['pricing-config'],
    queryFn: async () => {
      const { data, error } = await supabase.from('pricing_config').select('*').limit(1).single();
      if (error) throw error;
      return data as PricingConfig;
    },
  });
}

function usePricingModules() {
  return useQuery({
    queryKey: ['pricing-modules'],
    queryFn: async () => {
      const { data, error } = await supabase.from('pricing_modules').select('*').order('name');
      if (error) throw error;
      return data as PricingModule[];
    },
  });
}

function useOrganizations() {
  return useQuery({
    queryKey: ['admin-all-organizations'],
    queryFn: async () => {
      const { data, error } = await supabase.from('organizations').select('id, name, is_active').order('name');
      if (error) throw error;
      return data as Organization[];
    },
  });
}

function calculatePrice(
  config: PricingConfig | undefined,
  numUsers: number,
  numBranches: number,
  selectedModules: PricingModule[]
): number {
  if (!config) return 0;
  const extraUsers = Math.max(0, numUsers - config.base_users_included);
  const extraBranches = Math.max(0, numBranches - config.base_branches_included);
  const modulesTotal = selectedModules.reduce((sum, m) => sum + m.monthly_price, 0);
  return config.base_plan_price + extraUsers * config.price_per_extra_user + extraBranches * config.price_per_extra_branch + modulesTotal;
}

export default function AdminBillingPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: subscriptions = [], isLoading } = useSubscriptions();
  const { data: subModules = [] } = useSubscriptionModules();
  const { data: config } = usePricingConfig();
  const { data: pricingModules = [] } = usePricingModules();
  const { data: organizations = [] } = useOrganizations();

  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSub, setEditingSub] = useState<Subscription | null>(null);
  const [saving, setSaving] = useState(false);

  // Form
  const [formOrgId, setFormOrgId] = useState('');
  const [formUsers, setFormUsers] = useState(1);
  const [formBranches, setFormBranches] = useState(1);
  const [formStatus, setFormStatus] = useState('active');
  const [formModuleIds, setFormModuleIds] = useState<string[]>([]);

  const orgMap = Object.fromEntries(organizations.map((o) => [o.id, o.name]));
  const enabledModules = pricingModules.filter((m) => m.is_enabled);

  const selectedModulesForCalc = enabledModules.filter((m) => formModuleIds.includes(m.id));
  const calculatedPrice = calculatePrice(config, formUsers, formBranches, selectedModulesForCalc);

  // Orgs that don't have a subscription yet
  const orgsWithSub = new Set(subscriptions.map((s) => s.organization_id));
  const availableOrgs = organizations.filter((o) => !orgsWithSub.has(o.id));

  const filteredSubs = subscriptions.filter((s) => {
    const orgName = orgMap[s.organization_id] || '';
    return orgName.toLowerCase().includes(search.toLowerCase());
  });

  const openCreate = () => {
    setEditingSub(null);
    setFormOrgId(availableOrgs[0]?.id || '');
    setFormUsers(1);
    setFormBranches(1);
    setFormStatus('active');
    setFormModuleIds([]);
    setDialogOpen(true);
  };

  const openEdit = (sub: Subscription) => {
    setEditingSub(sub);
    setFormOrgId(sub.organization_id);
    setFormUsers(sub.number_of_users);
    setFormBranches(sub.number_of_branches);
    setFormStatus(sub.status);
    const moduleIds = subModules.filter((sm) => sm.subscription_id === sub.id).map((sm) => sm.pricing_module_id);
    setFormModuleIds(moduleIds);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const price = calculatePrice(config, formUsers, formBranches, enabledModules.filter((m) => formModuleIds.includes(m.id)));

      if (editingSub) {
        const { error } = await supabase
          .from('organization_subscriptions')
          .update({ number_of_users: formUsers, number_of_branches: formBranches, monthly_price: price, status: formStatus })
          .eq('id', editingSub.id);
        if (error) throw error;

        // Update modules: delete existing, insert new
        await supabase.from('subscription_modules').delete().eq('subscription_id', editingSub.id);
        if (formModuleIds.length > 0) {
          const { error: modErr } = await supabase.from('subscription_modules').insert(
            formModuleIds.map((mid) => ({ subscription_id: editingSub.id, pricing_module_id: mid }))
          );
          if (modErr) throw modErr;
        }
        toast({ title: 'Subscription updated' });
      } else {
        if (!formOrgId) {
          toast({ title: 'Select an organization', variant: 'destructive' });
          setSaving(false);
          return;
        }
        const { data: newSub, error } = await supabase
          .from('organization_subscriptions')
          .insert({ organization_id: formOrgId, number_of_users: formUsers, number_of_branches: formBranches, monthly_price: price, status: formStatus })
          .select()
          .single();
        if (error) throw error;
        if (formModuleIds.length > 0 && newSub) {
          const { error: modErr } = await supabase.from('subscription_modules').insert(
            formModuleIds.map((mid) => ({ subscription_id: newSub.id, pricing_module_id: mid }))
          );
          if (modErr) throw modErr;
        }
        toast({ title: 'Subscription created' });
      }
      queryClient.invalidateQueries({ queryKey: ['admin-subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['admin-subscription-modules'] });
      setDialogOpen(false);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (sub: Subscription) => {
    const newStatus = sub.status === 'active' ? 'suspended' : 'active';
    try {
      const { error } = await supabase.from('organization_subscriptions').update({ status: newStatus }).eq('id', sub.id);
      if (error) throw error;
      toast({ title: `Subscription ${newStatus}` });
      queryClient.invalidateQueries({ queryKey: ['admin-subscriptions'] });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const totalMRR = subscriptions.filter((s) => s.status === 'active').reduce((sum, s) => sum + s.monthly_price, 0);
  const activeSubs = subscriptions.filter((s) => s.status === 'active').length;

  const getSubModuleNames = (subId: string) => {
    const modIds = subModules.filter((sm) => sm.subscription_id === subId).map((sm) => sm.pricing_module_id);
    return pricingModules.filter((m) => modIds.includes(m.id)).map((m) => m.name);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Billing & Subscriptions</h1>
            <p className="text-muted-foreground">Manage organization subscriptions and billing</p>
          </div>
          <Button onClick={openCreate} disabled={availableOrgs.length === 0}>
            <CreditCard className="h-4 w-4 mr-2" />
            New Subscription
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{formatCurrency(totalMRR)}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Subscriptions</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{activeSubs}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Subscriptions</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{subscriptions.length}</div></CardContent>
          </Card>
        </div>

        {/* Table */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <CardTitle>All Subscriptions</CardTitle>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search by organization..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
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
                      <TableHead>Users</TableHead>
                      <TableHead>Branches</TableHead>
                      <TableHead>Modules</TableHead>
                      <TableHead>Monthly Price</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSubs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-8">No subscriptions found</TableCell>
                      </TableRow>
                    ) : (
                      filteredSubs.map((sub) => {
                        const modNames = getSubModuleNames(sub.id);
                        return (
                          <TableRow key={sub.id}>
                            <TableCell className="font-medium">{orgMap[sub.organization_id] || sub.organization_id.slice(0, 8)}</TableCell>
                            <TableCell>{sub.number_of_users}</TableCell>
                            <TableCell>{sub.number_of_branches}</TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1">
                                {modNames.length === 0 ? (
                                  <span className="text-muted-foreground text-xs">None</span>
                                ) : (
                                  modNames.map((n) => <Badge key={n} variant="secondary" className="text-xs">{n}</Badge>)
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="font-medium">{formatCurrency(sub.monthly_price)}</TableCell>
                            <TableCell>
                              <Badge variant={sub.status === 'active' ? 'default' : 'secondary'}>
                                {sub.status === 'active' ? 'Active' : 'Suspended'}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button variant="ghost" size="icon" onClick={() => openEdit(sub)} title="Edit">
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleToggleStatus(sub)}
                                >
                                  <Badge variant={sub.status === 'active' ? 'secondary' : 'default'} className="cursor-pointer text-xs px-1.5 py-0">
                                    {sub.status === 'active' ? 'Suspend' : 'Activate'}
                                  </Badge>
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

      {/* Create/Edit Subscription Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingSub ? 'Edit Subscription' : 'New Subscription'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {!editingSub && (
              <div className="space-y-2">
                <Label>Organization</Label>
                <Select value={formOrgId} onValueChange={setFormOrgId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select organization" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableOrgs.map((org) => (
                      <SelectItem key={org.id} value={org.id}>{org.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {editingSub && (
              <div className="space-y-2">
                <Label>Organization</Label>
                <Input value={orgMap[editingSub.organization_id] || ''} disabled />
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Number of Users</Label>
                <Input type="number" min={1} value={formUsers} onChange={(e) => setFormUsers(Number(e.target.value))} />
              </div>
              <div className="space-y-2">
                <Label>Number of Branches</Label>
                <Input type="number" min={1} value={formBranches} onChange={(e) => setFormBranches(Number(e.target.value))} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={formStatus} onValueChange={setFormStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {enabledModules.length > 0 && (
              <div className="space-y-2">
                <Label>Add-on Modules</Label>
                <div className="space-y-2 border rounded-md p-3">
                  {enabledModules.map((mod) => (
                    <div key={mod.id} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          checked={formModuleIds.includes(mod.id)}
                          onCheckedChange={(checked) => {
                            setFormModuleIds((prev) =>
                              checked ? [...prev, mod.id] : prev.filter((id) => id !== mod.id)
                            );
                          }}
                        />
                        <span className="text-sm">{mod.name}</span>
                      </div>
                      <span className="text-sm text-muted-foreground">{formatCurrency(mod.monthly_price)}/mo</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Separator />

            {/* Price Breakdown */}
            <div className="space-y-2 bg-muted/50 rounded-md p-4">
              <h4 className="font-medium text-sm">Price Breakdown</h4>
              {config && (
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Base Plan</span>
                    <span>{formatCurrency(config.base_plan_price)}</span>
                  </div>
                  {formUsers > config.base_users_included && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Extra Users ({formUsers - config.base_users_included} × {formatCurrency(config.price_per_extra_user)})
                      </span>
                      <span>{formatCurrency((formUsers - config.base_users_included) * config.price_per_extra_user)}</span>
                    </div>
                  )}
                  {formBranches > config.base_branches_included && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">
                        Extra Branches ({formBranches - config.base_branches_included} × {formatCurrency(config.price_per_extra_branch)})
                      </span>
                      <span>{formatCurrency((formBranches - config.base_branches_included) * config.price_per_extra_branch)}</span>
                    </div>
                  )}
                  {selectedModulesForCalc.length > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Modules ({selectedModulesForCalc.length})</span>
                      <span>{formatCurrency(selectedModulesForCalc.reduce((s, m) => s + m.monthly_price, 0))}</span>
                    </div>
                  )}
                  <Separator className="my-2" />
                  <div className="flex justify-between font-bold">
                    <span>Total Monthly</span>
                    <span>{formatCurrency(calculatedPrice)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingSub ? 'Save Changes' : 'Create Subscription'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
