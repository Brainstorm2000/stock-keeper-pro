import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { formatCurrency } from '@/lib/currency';
import { Loader2, Save, Plus, Pencil, Trash2, DollarSign, Users, GitBranch, Package } from 'lucide-react';

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
  description: string | null;
  monthly_price: number;
  is_enabled: boolean;
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

export default function AdminPricingPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: config, isLoading: configLoading } = usePricingConfig();
  const { data: modules = [], isLoading: modulesLoading } = usePricingModules();

  const [basePlanPrice, setBasePlanPrice] = useState(0);
  const [baseUsers, setBaseUsers] = useState(1);
  const [pricePerUser, setPricePerUser] = useState(0);
  const [baseBranches, setBaseBranches] = useState(1);
  const [pricePerBranch, setPricePerBranch] = useState(0);
  const [savingConfig, setSavingConfig] = useState(false);

  const [moduleDialogOpen, setModuleDialogOpen] = useState(false);
  const [editingModule, setEditingModule] = useState<PricingModule | null>(null);
  const [deleteModuleId, setDeleteModuleId] = useState<string | null>(null);
  const [modName, setModName] = useState('');
  const [modDesc, setModDesc] = useState('');
  const [modPrice, setModPrice] = useState(0);
  const [modEnabled, setModEnabled] = useState(true);
  const [savingModule, setSavingModule] = useState(false);

  useEffect(() => {
    if (config) {
      setBasePlanPrice(config.base_plan_price);
      setBaseUsers(config.base_users_included);
      setPricePerUser(config.price_per_extra_user);
      setBaseBranches(config.base_branches_included);
      setPricePerBranch(config.price_per_extra_branch);
    }
  }, [config]);

  const handleSaveConfig = async () => {
    if (!config) return;
    setSavingConfig(true);
    try {
      const { error } = await supabase
        .from('pricing_config')
        .update({
          base_plan_price: basePlanPrice,
          base_users_included: baseUsers,
          price_per_extra_user: pricePerUser,
          base_branches_included: baseBranches,
          price_per_extra_branch: pricePerBranch,
        })
        .eq('id', config.id);
      if (error) throw error;
      toast({ title: 'Pricing configuration saved' });
      queryClient.invalidateQueries({ queryKey: ['pricing-config'] });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSavingConfig(false);
    }
  };

  const openCreateModule = () => {
    setEditingModule(null);
    setModName('');
    setModDesc('');
    setModPrice(0);
    setModEnabled(true);
    setModuleDialogOpen(true);
  };

  const openEditModule = (mod: PricingModule) => {
    setEditingModule(mod);
    setModName(mod.name);
    setModDesc(mod.description || '');
    setModPrice(mod.monthly_price);
    setModEnabled(mod.is_enabled);
    setModuleDialogOpen(true);
  };

  const handleSaveModule = async () => {
    if (!modName.trim()) {
      toast({ title: 'Module name is required', variant: 'destructive' });
      return;
    }
    setSavingModule(true);
    try {
      if (editingModule) {
        const { error } = await supabase
          .from('pricing_modules')
          .update({ name: modName, description: modDesc || null, monthly_price: modPrice, is_enabled: modEnabled })
          .eq('id', editingModule.id);
        if (error) throw error;
        toast({ title: 'Module updated' });
      } else {
        const { error } = await supabase
          .from('pricing_modules')
          .insert({ name: modName, description: modDesc || null, monthly_price: modPrice, is_enabled: modEnabled });
        if (error) throw error;
        toast({ title: 'Module created' });
      }
      queryClient.invalidateQueries({ queryKey: ['pricing-modules'] });
      setModuleDialogOpen(false);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSavingModule(false);
    }
  };

  const handleToggleModule = async (mod: PricingModule) => {
    try {
      const { error } = await supabase.from('pricing_modules').update({ is_enabled: !mod.is_enabled }).eq('id', mod.id);
      if (error) throw error;
      toast({ title: mod.is_enabled ? 'Module disabled' : 'Module enabled' });
      queryClient.invalidateQueries({ queryKey: ['pricing-modules'] });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const handleDeleteModule = async () => {
    if (!deleteModuleId) return;
    try {
      const { error } = await supabase.from('pricing_modules').delete().eq('id', deleteModuleId);
      if (error) throw error;
      toast({ title: 'Module deleted' });
      queryClient.invalidateQueries({ queryKey: ['pricing-modules'] });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setDeleteModuleId(null);
    }
  };

  if (configLoading || modulesLoading) {
    return (
      <AdminLayout>
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Pricing Configuration</h1>
          <p className="text-muted-foreground">Configure subscription pricing for users, branches, and modules</p>
        </div>

        {/* Base Plan Pricing */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Base Plan Pricing
            </CardTitle>
            <CardDescription>Set the base price and included resources for all subscriptions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Base Plan Price (Monthly)</Label>
                <Input type="number" min={0} step={0.01} value={basePlanPrice} onChange={(e) => setBasePlanPrice(Number(e.target.value))} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-medium">User Pricing</h3>
                </div>
                <div className="space-y-2">
                  <Label>Base Users Included</Label>
                  <Input type="number" min={1} value={baseUsers} onChange={(e) => setBaseUsers(Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label>Price Per Additional User</Label>
                  <Input type="number" min={0} step={0.01} value={pricePerUser} onChange={(e) => setPricePerUser(Number(e.target.value))} />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <GitBranch className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-medium">Branch Pricing</h3>
                </div>
                <div className="space-y-2">
                  <Label>Base Branches Included</Label>
                  <Input type="number" min={1} value={baseBranches} onChange={(e) => setBaseBranches(Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label>Price Per Additional Branch</Label>
                  <Input type="number" min={0} step={0.01} value={pricePerBranch} onChange={(e) => setPricePerBranch(Number(e.target.value))} />
                </div>
              </div>
            </div>

            <Button onClick={handleSaveConfig} disabled={savingConfig}>
              {savingConfig ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
              Save Pricing Config
            </Button>
          </CardContent>
        </Card>

        {/* Modules */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Add-on Modules
                </CardTitle>
                <CardDescription>Manage available modules that organizations can subscribe to</CardDescription>
              </div>
              <Button onClick={openCreateModule}>
                <Plus className="h-4 w-4 mr-2" />
                Add Module
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Module</TableHead>
                  <TableHead>Monthly Price</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {modules.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">No modules configured</TableCell>
                  </TableRow>
                ) : (
                  modules.map((mod) => (
                    <TableRow key={mod.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{mod.name}</p>
                          {mod.description && <p className="text-xs text-muted-foreground">{mod.description}</p>}
                        </div>
                      </TableCell>
                      <TableCell>{formatCurrency(mod.monthly_price)}</TableCell>
                      <TableCell>
                        <Badge variant={mod.is_enabled ? 'default' : 'secondary'}>
                          {mod.is_enabled ? 'Active' : 'Disabled'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEditModule(mod)}><Pencil className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="icon" onClick={() => handleToggleModule(mod)}>
                            <Switch checked={mod.is_enabled} className="pointer-events-none" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteModuleId(mod.id)} className="text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* Module Create/Edit Dialog */}
      <Dialog open={moduleDialogOpen} onOpenChange={setModuleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingModule ? 'Edit Module' : 'Create Module'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={modName} onChange={(e) => setModName(e.target.value)} placeholder="e.g. Manufacturing" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={modDesc} onChange={(e) => setModDesc(e.target.value)} rows={2} placeholder="Optional description" />
            </div>
            <div className="space-y-2">
              <Label>Monthly Price</Label>
              <Input type="number" min={0} step={0.01} value={modPrice} onChange={(e) => setModPrice(Number(e.target.value))} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Enabled</Label>
              <Switch checked={modEnabled} onCheckedChange={setModEnabled} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModuleDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveModule} disabled={savingModule}>
              {savingModule && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingModule ? 'Save Changes' : 'Create Module'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Module Confirmation */}
      <AlertDialog open={!!deleteModuleId} onOpenChange={() => setDeleteModuleId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Module</AlertDialogTitle>
            <AlertDialogDescription>This will remove this module from all subscriptions.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteModule} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
