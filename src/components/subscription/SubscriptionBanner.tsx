import { AlertTriangle, Clock, XCircle, Sparkles } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  useOrgSubscription,
  getSubscriptionDaysRemaining,
} from "@/hooks/useSubscription";
import { useAuth } from "@/lib/auth";

export function SubscriptionBanner() {
  const { isSuperSuperAdmin } = useAuth();
  const { data: subscription } = useOrgSubscription();

  if (isSuperSuperAdmin || !subscription) return null;

  const daysRemaining = getSubscriptionDaysRemaining(subscription);
  const status = subscription.status;

  // Trial expired
  if (status === "trial" && daysRemaining !== null && daysRemaining <= 0) {
    return (
      <Alert
        variant="destructive"
        className="border-destructive/50 bg-destructive/10"
      >
        <XCircle className="h-4 w-4" />
        <AlertTitle>Trial Expired</AlertTitle>
        <AlertDescription>
          Your free trial has expired. Contact the developer to renew your
          subscription in order to continue using the system.
        </AlertDescription>
      </Alert>
    );
  }

  // Trial active
  if (status === "trial") {
    return (
      <Alert className="border-primary/30 bg-primary/5">
        <Sparkles className="h-4 w-4 text-primary" />
        <AlertTitle className="text-[#FF9E3D]">Free Trial</AlertTitle>
        <AlertDescription>
          Your free trial expires in {daysRemaining} day
          {daysRemaining !== 1 ? "s" : ""}. Contact the developer to subscribe
          before your trial ends.
        </AlertDescription>
      </Alert>
    );
  }

  // Expired
  if (status === "expired") {
    return (
      <Alert
        variant="destructive"
        className="border-destructive/50 bg-destructive/10"
      >
        <XCircle className="h-4 w-4" />
        <AlertTitle>Subscription Expired</AlertTitle>
        <AlertDescription>
          Your organization's subscription has expired. Contact the developer to
          renew your subscription in order to continue using the system.
        </AlertDescription>
      </Alert>
    );
  }

  // Suspended
  if (status === "suspended") {
    return (
      <Alert
        variant="destructive"
        className="border-destructive/50 bg-destructive/10"
      >
        <XCircle className="h-4 w-4" />
        <AlertTitle>Subscription Suspended</AlertTitle>
        <AlertDescription>
          Your subscription has been suspended. Contact the developer to restore
          access.
        </AlertDescription>
      </Alert>
    );
  }

  // Active with warnings
  if (status === "active" && daysRemaining !== null) {
    if (daysRemaining <= 0) {
      return (
        <Alert
          variant="destructive"
          className="border-destructive/50 bg-destructive/10"
        >
          <XCircle className="h-4 w-4" />
          <AlertTitle>Subscription Expired</AlertTitle>
          <AlertDescription>
            Your organization's subscription has expired. Contact the developer
            to renew your subscription in order to continue using the system.
          </AlertDescription>
        </Alert>
      );
    }
    if (daysRemaining <= 3) {
      return (
        <Alert
          variant="destructive"
          className="border-destructive/30 bg-destructive/5"
        >
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Subscription Expiring Soon</AlertTitle>
          <AlertDescription>
            Your subscription will expire in {daysRemaining} day
            {daysRemaining !== 1 ? "s" : ""}. Contact the developer to renew and
            avoid interruption.
          </AlertDescription>
        </Alert>
      );
    }
    if (daysRemaining <= 7) {
      return (
        <Alert className="border-yellow-500/30 bg-yellow-500/5">
          <Clock className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
          <AlertTitle className="text-yellow-700 dark:text-yellow-400">
            Subscription Reminder
          </AlertTitle>
          <AlertDescription className="text-yellow-700 dark:text-yellow-400">
            Your subscription will expire in {daysRemaining} day
            {daysRemaining !== 1 ? "s" : ""}.
          </AlertDescription>
        </Alert>
      );
    }
  }

  return null;
}
