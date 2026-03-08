import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';

export interface OrgSubscription {
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

export function useOrgSubscription() {
  const { organizationId } = useAuth();

  return useQuery({
    queryKey: ['org-subscription', organizationId],
    queryFn: async () => {
      if (!organizationId) return null;
      const { data, error } = await supabase
        .from('organization_subscriptions')
        .select('*')
        .eq('organization_id', organizationId)
        .maybeSingle();
      if (error) throw error;
      return data as OrgSubscription | null;
    },
    enabled: !!organizationId,
  });
}

export function getSubscriptionDaysRemaining(sub: OrgSubscription | null | undefined): number | null {
  if (!sub) return null;
  
  // Lifetime never expires
  if (sub.status === 'lifetime') return null;
  
  const now = new Date();
  
  if (sub.status === 'trial' && sub.trial_end_date) {
    const end = new Date(sub.trial_end_date);
    return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  }
  
  if ((sub.status === 'active' || sub.status === 'expired') && sub.subscription_end_date) {
    const end = new Date(sub.subscription_end_date);
    return Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  }
  
  return null;
}

export function isSubscriptionExpired(sub: OrgSubscription | null | undefined): boolean {
  if (!sub) return false;
  if (sub.status === 'expired') return true;
  if (sub.status === 'suspended') return true;
  
  const days = getSubscriptionDaysRemaining(sub);
  if (days !== null && days <= 0) return true;
  
  return false;
}
