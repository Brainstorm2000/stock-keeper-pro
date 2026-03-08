import { useCallback } from 'react';
import { useOrgSubscription, isSubscriptionExpired } from '@/hooks/useSubscription';
import { useAuth } from '@/lib/auth';
import { toast } from '@/hooks/use-toast';

/**
 * Hook that provides a guard function for restricted actions.
 * Call `guardAction` before performing any create/edit/delete operation.
 * Returns true if the action is allowed, false if blocked (and shows a toast).
 */
export function useSubscriptionGuard() {
  const { isSuperSuperAdmin } = useAuth();
  const { data: subscription } = useOrgSubscription();

  const expired = !isSuperSuperAdmin && isSubscriptionExpired(subscription);

  const guardAction = useCallback((): boolean => {
    if (expired) {
      toast({
        variant: 'destructive',
        title: 'Subscription Expired',
        description:
          "Your organization's subscription has expired. Please contact the developer to renew your subscription in order to continue using the system.",
      });
      return false;
    }
    return true;
  }, [expired]);

  return { isExpired: expired, guardAction };
}
