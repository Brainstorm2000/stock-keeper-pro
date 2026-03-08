import { ReactNode } from 'react';
import { useOrgSubscription, isSubscriptionExpired } from '@/hooks/useSubscription';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldAlert } from 'lucide-react';

interface SubscriptionGuardProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export function SubscriptionGuard({ children, fallback }: SubscriptionGuardProps) {
  const { isSuperSuperAdmin } = useAuth();
  const { data: subscription, isLoading } = useOrgSubscription();

  if (isSuperSuperAdmin) return <>{children}</>;
  if (isLoading) return <>{children}</>;

  if (isSubscriptionExpired(subscription)) {
    return fallback ?? (
      <Card className="border-destructive/40 bg-destructive/5 max-w-2xl mx-auto mt-8">
        <CardHeader className="flex flex-row items-center gap-3 pb-2">
          <ShieldAlert className="h-6 w-6 text-destructive" />
          <CardTitle className="text-destructive text-lg">Subscription Expired</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Your organization's subscription has expired. You can still view your existing data, 
            but creating, editing, or deleting records is restricted.
          </p>
          <p className="text-sm font-medium text-foreground">
            Please contact the developer to renew your subscription in order to continue using the system.
          </p>
        </CardContent>
      </Card>
    );
  }

  return <>{children}</>;
}
