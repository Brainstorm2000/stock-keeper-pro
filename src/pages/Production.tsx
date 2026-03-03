import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ModuleAccessGuard } from '@/components/access/ModuleAccessGuard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/lib/auth';
import { RawMaterialsTab } from '@/components/production/RawMaterialsTab';
import { BOMTab } from '@/components/production/BOMTab';
import { WorkOrdersTab } from '@/components/production/WorkOrdersTab';
import { ProductionAnalyticsTab } from '@/components/production/ProductionAnalyticsTab';

export default function Production() {
  const { user, loading: authLoading, hasCompletedOnboarding } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
    else if (!authLoading && user && hasCompletedOnboarding === false) navigate('/onboarding');
  }, [user, authLoading, hasCompletedOnboarding, navigate]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <DashboardLayout>
      <ModuleAccessGuard module="production">
        <div className="space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Production</h1>
            <p className="text-muted-foreground">Manage raw materials, BOMs, and manufacturing work orders</p>
          </div>

          <Tabs defaultValue="raw-materials" className="space-y-4">
            <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
              <TabsTrigger value="raw-materials">Raw Materials</TabsTrigger>
              <TabsTrigger value="bom">BOM</TabsTrigger>
              <TabsTrigger value="work-orders">Work Orders</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
            </TabsList>

            <TabsContent value="raw-materials"><RawMaterialsTab /></TabsContent>
            <TabsContent value="bom"><BOMTab /></TabsContent>
            <TabsContent value="work-orders"><WorkOrdersTab /></TabsContent>
            <TabsContent value="analytics"><ProductionAnalyticsTab /></TabsContent>
          </Tabs>
        </div>
      </ModuleAccessGuard>
    </DashboardLayout>
  );
}
