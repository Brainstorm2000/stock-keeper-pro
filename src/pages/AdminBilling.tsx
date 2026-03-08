import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/currency';
import { Search, Pencil, Loader2, DollarSign, Building2, Activity, CreditCard, Calendar, AlertTriangle } from 'lucide-react';
import { format, differenceInDays, addDays } from 'date-fns';

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
  yearly_discount_percent: number;
}

interface PricingModule {
  id: string;
  name: string;
  monthly_price: number;
  is_enabled: boolean;
}

interface PricingPlan {
  id: string;
  name: string;
  max_users: number;
  max_branches: number;
  base_price: number;
  is_active: boolean;
}

interface Subscription {
  id: string;
  organization_id: string;
  number_of_users: number;
  number_of_branches: number;
  monthly_price: number;
  status: string;
  billing_cycle: string;
  plan_id: string | null;
  trial_start_date: string | null;
  trial_end_date: string | null;
  subscription_start_date: string | null;
  subscription_end_date: string | null;
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

function usePricingPlans() {
  return useQuery({
    queryKey: ['pricing-plans'],
    queryFn: async () => {
      const { data, error } = await supabase.from('pricing_plans').select('*').order('sort_order');
      if (error) throw error;
      return data as PricingPlan[];
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

function useOrgCounts() {
  return useQuery({
    queryKey: ['admin-org-counts'],
    queryFn: async () => {
      const [{ data: profiles }, { data: branches }] = await Promise.all([
        supabase.from('profiles').select('organization_id'),
        supabase.from('branches').select('organization_id'),
      ]);
      const userCounts: Record<string, number> = {};
      const branchCounts: Record<string, number> = {};
      (profiles || []).forEach((p: any) => {
        if (p.organization_id) userCounts[p.organization_id] = (userCounts[p.organization_id] || 0) + 1;
      });
      (branches || []).forEach((b: any) => {
        if (b.organization_id) branchCounts[b.organization_id] = (branchCounts[b.organization_id] || 0) + 1;
      });
      return { userCounts, branchCounts };
    },
  });
}

function calculatePrice(
  config: PricingConfig | undefined,
  plan: PricingPlan | undefined,
  numUsers: number,
  numBranches: number,
  selectedModules: PricingModule[],
  billingCycle: string
): { monthly: number; total: number; discount: number } {
  if (!config) return { monthly: 0, total: 0, discount: 0 };

  const basePlanPrice = plan ? plan.base_price : config.base_plan_price;
  const baseUsersIncluded = config.base_users_included;
  const baseBranchesIncluded = config.base_branches_included;

  const extraUsers = Math.max(0, numUsers - baseUsersIncluded);
  const extraBranches = Math.max(0, numBranches - baseBranchesIncluded);
  const modulesTotal = selectedModules.reduce((sum, m) => sum + m.monthly_price, 0);
  const monthly = basePlanPrice + extraUsers * config.price_per_extra_user + extraBranches * config.price_per_extra_branch + modulesTotal;

  if (billingCycle === 'yearly') {
    const yearlyFull = monthly * 12;
    const discount = yearlyFull * (config.yearly_discount_percent / 100);
    const total = yearlyFull - discount;
    return { monthly, total, discount };
  }

  return { monthly, total: monthly, discount: 0 };
}

export default function AdminBillingPage() { // eslint-disable-line
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: subscriptions = [], isLoading } = useSubscriptions();
  const { data: subModules = [] } = useSubscriptionModules();
  const { data: config } = usePricingConfig();
  const { data: pricingModules = [] } = usePricingModules();
  const { data: plans = [] } = usePricingPlans();
  const { data: organizations = [] } = useOrganizations();
  const { data: orgCounts } = useOrgCounts();

  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSub, setEditingSub] = useState<Subscription | null>(null);
  const [saving, setSaving] = useState(false);

  // Form
  const [formOrgId, setFormOrgId] = useState('');
  const [formPlanId, setFormPlanId] = useState<string>('');
  const [formUsers, setFormUsers] = useState(1);
  const [formBranches, setFormBranches] = useState(1);
  const [formStatus, setFormStatus] = useState('trial');
  const [formBillingCycle, setFormBillingCycle] = useState('monthly');
  const [formModuleIds, setFormModuleIds] = useState<string[]>([]);
  const [formTrialEnd, setFormTrialEnd] = useState('');
  const [formSubStart, setFormSubStart] = useState('');
  const [formSubEnd, setFormSubEnd] = useState('');

  const orgMap = Object.fromEntries(organizations.map((o) => [o.id, o.name]));
  const planMap = Object.fromEntries(plans.map((p) => [p.id, p]));
  const enabledModules = pricingModules.filter((m) => m.is_enabled);
  const activePlans = plans.filter((p) => p.is_active);

  const selectedPlan = formPlanId ? planMap[formPlanId] : undefined;
  const selectedModulesForCalc = enabledModules.filter((m) => formModuleIds.includes(m.id));
  const priceCalc = calculatePrice(config, selectedPlan, formUsers, formBranches, selectedModulesForCalc, formBillingCycle);

  // Enforce plan limits
  const maxUsers = selectedPlan ? selectedPlan.max_users : Infinity;
  const maxBranches = selectedPlan ? selectedPlan.max_branches : Infinity;

  const orgsWithSub = new Set(subscriptions.map((s) => s.organization_id));
  const availableOrgs = organizations.filter((o) => !orgsWithSub.has(o.id));

  const filteredSubs = subscriptions.filter((s) => {
    const orgName = orgMap[s.organization_id] || '';
    return orgName.toLowerCase().includes(search.toLowerCase());
  });

  const handlePlanChange = (planId: string) => {
    setFormPlanId(planId);
    const plan = planMap[planId];
    if (plan) {
      if (formUsers > plan.max_users) setFormUsers(plan.max_users);
      if (formBranches > plan.max_branches) setFormBranches(plan.max_branches);
    }
  };

  const openCreate = () => {
    setEditingSub(null);
    setFormOrgId(availableOrgs[0]?.id || '');
    setFormPlanId(activePlans[0]?.id || '');
    setFormUsers(1);
    setFormBranches(1);
    setFormStatus('trial');
    setFormBillingCycle('monthly');
    setFormModuleIds([]);
    const now = new Date();
    setFormTrialEnd(format(addDays(now, 14), 'yyyy-MM-dd'));
    setFormSubStart('');
    setFormSubEnd('');
    setDialogOpen(true);
  };

  const openEdit = (sub: Subscription) => {
    setEditingSub(sub);
    setFormOrgId(sub.organization_id);
    setFormPlanId(sub.plan_id || '');
    setFormUsers(sub.number_of_users);
    setFormBranches(sub.number_of_branches);
    setFormStatus(sub.status);
    setFormBillingCycle(sub.billing_cycle || 'monthly');
    setFormTrialEnd(sub.trial_end_date ? format(new Date(sub.trial_end_date), 'yyyy-MM-dd') : '');
    setFormSubStart(sub.subscription_start_date ? format(new Date(sub.subscription_start_date), 'yyyy-MM-dd') : '');
    setFormSubEnd(sub.subscription_end_date ? format(new Date(sub.subscription_end_date), 'yyyy-MM-dd') : '');
    const moduleIds = subModules.filter((sm) => sm.subscription_id === sub.id).map((sm) => sm.pricing_module_id);
    setFormModuleIds(moduleIds);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    // Validate plan limits
    if (selectedPlan) {
      if (formUsers > selectedPlan.max_users) {
        toast({ title: `This plan allows max ${selectedPlan.max_users} users`, variant: 'destructive' });
        return;
      }
      if (formBranches > selectedPlan.max_branches) {
        toast({ title: `This plan allows max ${selectedPlan.max_branches} branches`, variant: 'destructive' });
        return;
      }
    }

    setSaving(true);
    try {
      const selMods = enabledModules.filter((m) => formModuleIds.includes(m.id));
      const { monthly } = calculatePrice(config, selectedPlan, formUsers, formBranches, selMods, formBillingCycle);

      const now = new Date().toISOString();
      const payload: any = {
        number_of_users: formUsers,
        number_of_branches: formBranches,
        monthly_price: monthly,
        status: formStatus,
        billing_cycle: formBillingCycle,
        plan_id: formPlanId || null,
        trial_end_date: formTrialEnd ? new Date(formTrialEnd).toISOString() : null,
        subscription_start_date: formSubStart ? new Date(formSubStart).toISOString() : null,
        subscription_end_date: formSubEnd ? new Date(formSubEnd).toISOString() : null,
      };

      // For new subscriptions with trial status, set trial_start_date
      if (!editingSub && formStatus === 'trial') {
        payload.trial_start_date = now;
      }

      if (editingSub) {
        const { error } = await supabase.from('organization_subscriptions').update(payload).eq('id', editingSub.id);
        if (error) throw error;

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
          .insert({ organization_id: formOrgId, ...payload })
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

  const totalMRR = subscriptions.filter((s) => s.status === 'active' || s.status === 'lifetime').reduce((sum, s) => sum + s.monthly_price, 0);
  const activeSubs = subscriptions.filter((s) => s.status === 'active' || s.status === 'lifetime').length;
  const trialSubs = subscriptions.filter((s) => s.status === 'trial').length;
  const expiredSubs = subscriptions.filter((s) => s.status === 'expired').length;

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
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{formatCurrency(totalMRR)}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{activeSubs}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">On Trial</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{trialSubs}</div></CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Expired</CardTitle>
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent><div className="text-2xl font-bold">{expiredSubs}</div></CardContent>
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
                      <TableHead>Plan</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Days Left</TableHead>
                      <TableHead>Users</TableHead>
                      <TableHead>Branches</TableHead>
                      <TableHead>Monthly Price</TableHead>
                      <TableHead>End Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSubs.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center text-muted-foreground py-8">No subscriptions found</TableCell>
                      </TableRow>
                    ) : (
                      filteredSubs.map((sub) => {
                        const plan = sub.plan_id ? planMap[sub.plan_id] : null;
                        const isLifetime = sub.status === 'lifetime';
                        const endDate = sub.status === 'trial' ? sub.trial_end_date : sub.subscription_end_date;
                        let daysLeft: number | null = null;
                        if (!isLifetime && endDate) {
                          try { daysLeft = differenceInDays(new Date(endDate), new Date()); } catch { daysLeft = null; }
                        }
                        const endDateObj = endDate ? new Date(endDate) : null;
                        const endDateStr = endDateObj && !isNaN(endDateObj.getTime()) ? format(endDateObj, 'MMM d, yyyy') : '—';
                        const statusVariant = sub.status === 'active' ? 'default' as const
                          : sub.status === 'lifetime' ? 'default' as const
                          : sub.status === 'trial' ? 'secondary' as const
                          : 'destructive' as const;
                        return (
                          <TableRow key={sub.id}>
                            <TableCell className="font-medium">{orgMap[sub.organization_id] || sub.organization_id.slice(0, 8)}</TableCell>
                            <TableCell>
                              {plan ? (
                                <Badge variant="outline">{plan.name}</Badge>
                              ) : (
                                <span className="text-muted-foreground text-xs">Custom</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge variant={statusVariant} className="text-xs capitalize">
                                {sub.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {isLifetime ? (
                                <Badge variant="default" className="text-xs">∞ Lifetime</Badge>
                              ) : daysLeft !== null ? (
                                <span className={daysLeft <= 3 ? 'text-destructive font-semibold' : daysLeft <= 7 ? 'text-yellow-600 dark:text-yellow-400 font-medium' : ''}>
                                  {daysLeft <= 0 ? 'Expired' : `${daysLeft}d`}
                                </span>
                              ) : (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </TableCell>
                            <TableCell>{orgCounts?.userCounts[sub.organization_id] ?? 0} / {sub.number_of_users}</TableCell>
                            <TableCell>{orgCounts?.branchCounts[sub.organization_id] ?? 0} / {sub.number_of_branches}</TableCell>
                            <TableCell className="font-medium">{formatCurrency(sub.monthly_price)}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {endDateStr}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                <Button variant="ghost" size="icon" onClick={() => openEdit(sub)} title="Edit">
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="sm" onClick={() => handleToggleStatus(sub)}>
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
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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

            {/* Plan Selection */}
            <div className="space-y-2">
              <Label>Subscription Plan</Label>
              <Select value={formPlanId} onValueChange={handlePlanChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a plan" />
                </SelectTrigger>
                <SelectContent>
                  {activePlans.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.name} — {formatCurrency(plan.base_price)}/mo (up to {plan.max_users} users, {plan.max_branches} branches)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedPlan && (
                <p className="text-xs text-muted-foreground">
                  Limits: max {selectedPlan.max_users} users, max {selectedPlan.max_branches} branches
                </p>
              )}
            </div>

            {/* Billing Cycle */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" />
                Billing Cycle
              </Label>
              <Select value={formBillingCycle} onValueChange={setFormBillingCycle}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="yearly">
                    Yearly {config && config.yearly_discount_percent > 0 ? `(${config.yearly_discount_percent}% discount)` : ''}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Number of Users</Label>
                <Input
                  type="number"
                  min={1}
                  max={maxUsers === Infinity ? undefined : maxUsers}
                  value={formUsers}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setFormUsers(maxUsers !== Infinity ? Math.min(val, maxUsers) : val);
                  }}
                />
                {selectedPlan && (
                  <p className="text-xs text-muted-foreground">Max: {selectedPlan.max_users}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>Number of Branches</Label>
                <Input
                  type="number"
                  min={1}
                  max={maxBranches === Infinity ? undefined : maxBranches}
                  value={formBranches}
                  onChange={(e) => {
                    const val = Number(e.target.value);
                    setFormBranches(maxBranches !== Infinity ? Math.min(val, maxBranches) : val);
                  }}
                />
                {selectedPlan && (
                  <p className="text-xs text-muted-foreground">Max: {selectedPlan.max_branches}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={formStatus} onValueChange={setFormStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="trial">Trial</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="lifetime">Lifetime</SelectItem>
                  <SelectItem value="expired">Expired</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date Fields */}
            {formStatus === 'trial' && (
              <div className="space-y-2">
                <Label>Trial End Date</Label>
                <Input type="date" value={formTrialEnd} onChange={(e) => setFormTrialEnd(e.target.value)} />
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Subscription Start</Label>
                <Input type="date" value={formSubStart} onChange={(e) => setFormSubStart(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Subscription End</Label>
                <Input type="date" value={formSubEnd} onChange={(e) => setFormSubEnd(e.target.value)} />
              </div>
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
                    <span className="text-muted-foreground">
                      {selectedPlan ? `${selectedPlan.name} Plan` : 'Base Plan'}
                    </span>
                    <span>{formatCurrency(selectedPlan ? selectedPlan.base_price : config.base_plan_price)}</span>
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
                  <div className="flex justify-between font-semibold">
                    <span>Monthly Total</span>
                    <span>{formatCurrency(priceCalc.monthly)}</span>
                  </div>
                  {formBillingCycle === 'yearly' && (
                    <>
                      <div className="flex justify-between text-muted-foreground">
                        <span>Yearly (12 months)</span>
                        <span>{formatCurrency(priceCalc.monthly * 12)}</span>
                      </div>
                      {priceCalc.discount > 0 && (
                        <div className="flex justify-between text-green-600 dark:text-green-400">
                          <span>Yearly Discount ({config.yearly_discount_percent}%)</span>
                          <span>-{formatCurrency(priceCalc.discount)}</span>
                        </div>
                      )}
                      <Separator className="my-2" />
                      <div className="flex justify-between font-bold text-base">
                        <span>Yearly Total</span>
                        <span>{formatCurrency(priceCalc.total)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Effective monthly: {formatCurrency(priceCalc.total / 12)}
                      </p>
                    </>
                  )}
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

