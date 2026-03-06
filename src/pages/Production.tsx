import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ModuleAccessGuard } from '@/components/access/ModuleAccessGuard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { useAuth } from '@/lib/auth';
import { useBranches, useMyBranchAssignments } from '@/hooks/useBranches';
import { RawMaterialsTab } from '@/components/production/RawMaterialsTab';
import { BOMTab } from '@/components/production/BOMTab';
import { WorkOrdersTab } from '@/components/production/WorkOrdersTab';
import { ProductionAnalyticsTab } from '@/components/production/ProductionAnalyticsTab';
import { DamagesTab } from '@/components/production/DamagesTab';

export default function Production() {
  const { user, loading: authLoading, hasCompletedOnboarding, isSuperAdmin } = useAuth();
  const navigate = useNavigate();
  const { data: branches = [] } = useBranches();
  const { data: myBranchAssignments = [] } = useMyBranchAssignments();

  const myBranchIds = myBranchAssignments.map(a => a.branch_id);
  const accessibleBranches = isSuperAdmin ? branches : branches.filter(b => myBranchIds.includes(b.id));

  const [selectedBranchId, setSelectedBranchId] = useState<string>('all');

  // Auto-select if user has exactly one branch
  useEffect(() => {
    if (accessibleBranches.length === 1 && selectedBranchId === 'all') {
      setSelectedBranchId(accessibleBranches[0].id);
    }
  }, [accessibleBranches, selectedBranchId]);

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

  if (accessibleBranches.length === 0) {
    return (
      <DashboardLayout>
        <ModuleAccessGuard module="production">
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground py-8">
                You need to be assigned to at least one branch to access Production. Contact your administrator.
              </p>
            </CardContent>
          </Card>
        </ModuleAccessGuard>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <ModuleAccessGuard module="production">
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Production</h1>
              <p className="text-muted-foreground">Manage raw materials, BOMs, and manufacturing work orders</p>
            </div>
            {accessibleBranches.length > 1 && (
              <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filter by branch" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Branches</SelectItem>
                  {accessibleBranches.map(b => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <Tabs defaultValue="raw-materials" className="space-y-4">
            <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
              <TabsTrigger value="raw-materials">Raw Materials</TabsTrigger>
              <TabsTrigger value="bom">BOM</TabsTrigger>
              <TabsTrigger value="work-orders">Work Orders</TabsTrigger>
              <TabsTrigger value="damages">Damages & Waste</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
            </TabsList>

            <TabsContent value="raw-materials"><RawMaterialsTab /></TabsContent>
            <TabsContent value="bom"><BOMTab /></TabsContent>
            <TabsContent value="work-orders"><WorkOrdersTab branchFilter={selectedBranchId} /></TabsContent>
            <TabsContent value="damages"><DamagesTab branchFilter={selectedBranchId} /></TabsContent>
            <TabsContent value="analytics"><ProductionAnalyticsTab branchFilter={selectedBranchId} /></TabsContent>
          </Tabs>
        </div>
      </ModuleAccessGuard>
    </DashboardLayout>
  );
}
