import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, CreditCard, Users, Building2, Calendar, Clock, Package } from 'lucide-react';
import { format } from 'date-fns';
import { formatCurrency } from '@/lib/currency';
import { getSubscriptionDaysRemaining, useOrgSubscription } from '@/hooks/useSubscription';

export default function SubscriptionPage() {
  const { organizationId } = useAuth();
  const { data: sub, isLoading } = useOrgSubscription();

  const { data: counts } = useQuery({
    queryKey: ['org-sub-counts', organizationId],
    queryFn: async () => {
      if (!organizationId) return { users: 0, branches: 0 };
      const [{ count: userCount }, { count: branchCount }] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('organization_id', organizationId),
        supabase.from('branches').select('*', { count: 'exact', head: true }).eq('organization_id', organizationId),
      ]);
      return { users: userCount || 0, branches: branchCount || 0 };
    },
    enabled: !!organizationId,
  });

  const { data: modules = [] } = useQuery({
    queryKey: ['org-sub-modules', sub?.id],
    queryFn: async () => {
      if (!sub?.id) return [];
      const { data: subMods } = await supabase
        .from('subscription_modules')
        .select('pricing_module_id')
        .eq('subscription_id', sub.id);
      if (!subMods?.length) return [];
      const modIds = subMods.map((sm: any) => sm.pricing_module_id);
      const { data: mods } = await supabase
        .from('pricing_modules')
        .select('name')
        .in('id', modIds);
      return (mods || []).map((m: any) => m.name);
    },
    enabled: !!sub?.id,
  });

  const { data: plan } = useQuery({
    queryKey: ['org-sub-plan', sub?.plan_id],
    queryFn: async () => {
      if (!sub?.plan_id) return null;
      const { data } = await supabase.from('pricing_plans').select('name').eq('id', sub.plan_id).single();
      return data?.name || null;
    },
    enabled: !!sub?.plan_id,
  });

  const daysLeft = getSubscriptionDaysRemaining(sub);

  const safeFormat = (dateStr: string | null) => {
    if (!dateStr) return '—';
    try {
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? '—' : format(d, 'MMM d, yyyy');
    } catch {
      return '—';
    }
  };

  const statusVariant = sub?.status === 'active' ? 'default' as const
    : sub?.status === 'trial' ? 'secondary' as const
    : 'destructive' as const;

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (!sub) {
    return (
      <DashboardLayout>
        <div className="text-center py-20 text-muted-foreground">
          <CreditCard className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <h2 className="text-lg font-semibold">No Subscription Found</h2>
          <p className="text-sm">Contact support for subscription information.</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Subscription</h1>
          <p className="text-muted-foreground">View your organization's subscription details</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Status</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <Badge variant={statusVariant} className="capitalize text-sm">{sub.status}</Badge>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Days Remaining</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${daysLeft !== null && daysLeft <= 3 ? 'text-destructive' : daysLeft !== null && daysLeft <= 7 ? 'text-yellow-600 dark:text-yellow-400' : ''}`}>
                {daysLeft !== null ? (daysLeft <= 0 ? 'Expired' : `${daysLeft} days`) : '—'}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Users</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{counts?.users ?? 0}<span className="text-base text-muted-foreground font-normal">/{sub.number_of_users}</span></div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Branches</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{counts?.branches ?? 0}<span className="text-base text-muted-foreground font-normal">/{sub.number_of_branches}</span></div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Subscription Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Plan</p>
                <p className="font-medium">{plan || 'Custom'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Billing Cycle</p>
                <p className="font-medium capitalize">{sub.billing_cycle}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Monthly Price</p>
                <p className="font-medium">{formatCurrency(sub.monthly_price)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Trial End Date</p>
                <p className="font-medium">{safeFormat(sub.trial_end_date)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Subscription Start</p>
                <p className="font-medium">{safeFormat(sub.subscription_start_date)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Subscription End</p>
                <p className="font-medium">{safeFormat(sub.subscription_end_date)}</p>
              </div>
            </div>

            {modules.length > 0 && (
              <>
                <Separator />
                <div>
                  <p className="text-sm text-muted-foreground mb-2 flex items-center gap-1">
                    <Package className="h-4 w-4" /> Enabled Modules
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {modules.map((name: string) => (
                      <Badge key={name} variant="outline">{name}</Badge>
                    ))}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
