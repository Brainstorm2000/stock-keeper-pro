import { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldX, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useMyModuleAccess, hasAccess, AppModule, ModuleAccessLevel, MODULE_LABELS } from '@/hooks/useModulePermissions';
import { useAuth } from '@/lib/auth';

interface ModuleAccessGuardProps {
  module: AppModule;
  minLevel?: ModuleAccessLevel;
  children: ReactNode;
  fallback?: ReactNode;
}

export function ModuleAccessGuard({ 
  module, 
  minLevel = 'view', 
  children, 
  fallback 
}: ModuleAccessGuardProps) {
  const { loading: authLoading } = useAuth();
  const { data: moduleAccess, isLoading } = useMyModuleAccess();
  const navigate = useNavigate();

  // Still loading
  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Check access
  const hasRequiredAccess = hasAccess(moduleAccess, module, minLevel);

  if (!hasRequiredAccess) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div className="flex items-center justify-center py-20">
        <Card className="max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <ShieldX className="h-8 w-8 text-destructive" />
            </div>
            <CardTitle>Access Denied</CardTitle>
            <CardDescription>
              You don't have permission to access the {MODULE_LABELS[module]} module.
              Please contact your administrator if you believe this is an error.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Button onClick={() => navigate('/dashboard')}>
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}

// Hook to check access within components
export function useModuleAccess(module: AppModule) {
  const { data: moduleAccess, isLoading } = useMyModuleAccess();

  const accessLevel = moduleAccess?.[module] || 'none';

  return {
    isLoading,
    canView: hasAccess(moduleAccess, module, 'view'),
    canCreate: hasAccess(moduleAccess, module, 'create'),
    canEdit: hasAccess(moduleAccess, module, 'full'),
    canDelete: hasAccess(moduleAccess, module, 'full'),
    accessLevel,
  };
}
