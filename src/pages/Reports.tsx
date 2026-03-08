import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, BarChart3 } from 'lucide-react';
import { startOfMonth, endOfMonth } from 'date-fns';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ModuleAccessGuard } from '@/components/access/ModuleAccessGuard';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DateRangeFilter, DateRange } from '@/components/reports/DateRangeFilter';
import { SalesReportTab } from '@/components/reports/SalesReportTab';
import { InventoryReportTab } from '@/components/reports/InventoryReportTab';
import { PurchaseReportTab } from '@/components/reports/PurchaseReportTab';
import { ExpenseReportTab } from '@/components/reports/ExpenseReportTab';
import { useAuth } from '@/lib/auth';
import { useBranches } from '@/hooks/useBranches';
import { useProducts } from '@/hooks/useProducts';
import { useSales } from '@/hooks/useSales';
import { usePurchases } from '@/hooks/usePurchases';
import { useExpenses } from '@/hooks/useExpenses';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

export default function Reports() {
  const { user, loading: authLoading, hasCompletedOnboarding, organizationId } = useAuth();
  const navigate = useNavigate();
  const [selectedBranch, setSelectedBranch] = useState('all');
  const [dateRange, setDateRange] = useState<DateRange>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });

  const { data: branches = [] } = useBranches();
  const { data: products = [] } = useProducts();
  const { data: sales = [] } = useSales();
  const { data: purchases = [] } = usePurchases();
  const { expenses = [], categories = [] } = useExpenses();

  // Fetch sale items for sales report
  const { data: saleItems = [] } = useQuery({
    queryKey: ['all-sale-items', organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from('sale_items')
        .select('*, products(name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!organizationId,
  });

  useEffect(() => {
    if (!authLoading && !user) navigate('/auth');
    if (!authLoading && user && !hasCompletedOnboarding) navigate('/onboarding');
  }, [user, authLoading, hasCompletedOnboarding, navigate]);

  if (authLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <ModuleAccessGuard module="reports">
        <div className="space-y-6">
          {/* Header */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-6 w-6 text-primary" />
                <h1 className="text-2xl font-bold">Reports</h1>
              </div>
              <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Branches" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Branches</SelectItem>
                  {branches.map(b => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DateRangeFilter dateRange={dateRange} onDateRangeChange={setDateRange} />
          </div>

          {/* Tabs */}
          <Tabs defaultValue="sales" className="space-y-4">
            <TabsList className="grid grid-cols-4 w-full max-w-lg">
              <TabsTrigger value="sales">Sales</TabsTrigger>
              <TabsTrigger value="inventory">Inventory</TabsTrigger>
              <TabsTrigger value="purchases">Purchases</TabsTrigger>
              <TabsTrigger value="expenses">Expenses</TabsTrigger>
            </TabsList>

            <TabsContent value="sales">
              <SalesReportTab
                sales={sales}
                saleItems={saleItems}
                dateRange={dateRange}
                branches={branches}
                selectedBranch={selectedBranch}
              />
            </TabsContent>

            <TabsContent value="inventory">
              <InventoryReportTab
                products={products}
                branches={branches}
                selectedBranch={selectedBranch}
              />
            </TabsContent>

            <TabsContent value="purchases">
              <PurchaseReportTab
                purchases={purchases}
                dateRange={dateRange}
                branches={branches}
                selectedBranch={selectedBranch}
              />
            </TabsContent>

            <TabsContent value="expenses">
              <ExpenseReportTab
                expenses={expenses}
                categories={categories}
                dateRange={dateRange}
                branches={branches}
                selectedBranch={selectedBranch}
              />
            </TabsContent>
          </Tabs>
        </div>
      </ModuleAccessGuard>
    </DashboardLayout>
  );
}
