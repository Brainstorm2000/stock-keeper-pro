import { ReactNode } from 'react';
import { useOrgSubscription, isSubscriptionExpired } from '@/hooks/useSubscription';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';

interface SubscriptionGuardProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export function SubscriptionGuard({ children, fallback }: SubscriptionGuardProps) {
  const { isSuperSuperAdmin } = useAuth();
  const { data: subscription, isLoading } = useOrgSubscription();

  // Super super admins bypass subscription checks
  if (isSuperSuperAdmin) return <>{children}</>;
  
  // While loading, show children
  if (isLoading) return <>{children}</>;

  // If expired, show restriction
  if (isSubscriptionExpired(subscription)) {
    return fallback ?? (
      <Card className="border-destructive/30">
        <CardHeader className="flex flex-row items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          <CardTitle className="text-destructive">Subscription Required</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Your subscription has expired or been suspended. Please contact your administrator to renew your subscription and regain access to this feature.
          </p>
        </CardContent>
      </Card>
    );
  }

  return <>{children}</>;
}
