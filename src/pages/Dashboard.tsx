import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Ruler, MapPin, Users, History, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatsCards } from '@/components/dashboard/StatsCards';

import { StockHistoryTable } from '@/components/dashboard/StockHistoryTable';
import { StockForecastChart } from '@/components/dashboard/StockForecastChart';
import { ProductTable } from '@/components/products/ProductTable';
import { ProductDialog } from '@/components/products/ProductDialog';
import { UnitsDialog } from '@/components/units/UnitsDialog';
import { BranchesDialog } from '@/components/branches/BranchesDialog';
import { UsersManagementDialog } from '@/components/users/UsersManagementDialog';
import { CustomersDialog } from '@/components/customers/CustomersDialog';
import { SuppliersDialog } from '@/components/suppliers/SuppliersDialog';
import { BrandsDialog } from '@/components/brands/BrandsDialog';
import { useProducts, useDeleteProduct, type Product } from '@/hooks/useProducts';
import { useBranches, useMyBranchAssignments } from '@/hooks/useBranches';
import { useSales } from '@/hooks/useSales';
import { useExpenses } from '@/hooks/useExpenses';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function Dashboard() {
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [unitsDialogOpen, setUnitsDialogOpen] = useState(false);
  const [branchesDialogOpen, setBranchesDialogOpen] = useState(false);
  const [usersDialogOpen, setUsersDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deleteProductId, setDeleteProductId] = useState<string | null>(null);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all');
  
  const { user, loading: authLoading, isAdmin, isSuperAdmin, isSuperSuperAdmin, hasCompletedOnboarding } = useAuth();
  const { data: products = [], isLoading: productsLoading } = useProducts();
  const { data: branches = [] } = useBranches();
  const { data: myBranchAssignments = [] } = useMyBranchAssignments();
  const { data: sales = [] } = useSales();
  const { data: expenses = [] } = useExpenses();
  const deleteProduct = useDeleteProduct();
  const navigate = useNavigate();

  // Filter products by selected branch
  const filteredProducts = selectedBranchId === 'all' 
    ? products 
    : products.filter(p => p.branch_id === selectedBranchId);

  // Filter sales by selected branch
  const filteredSales = selectedBranchId === 'all'
    ? sales
    : sales.filter(s => s.branch_id === selectedBranchId);

  // Filter expenses by selected branch
  const filteredExpenses = selectedBranchId === 'all'
    ? expenses
    : expenses.filter(e => e.branch_id === selectedBranchId);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    } else if (!authLoading && user && isSuperSuperAdmin) {
      navigate('/admin');
    } else if (!authLoading && user && hasCompletedOnboarding === false) {
      navigate('/auth');
    }
  }, [user, authLoading, hasCompletedOnboarding, isSuperSuperAdmin, navigate]);

  // Real-time subscription for products
  useEffect(() => {
    const channel = supabase
      .channel('products-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'products' },
        () => {
          // Invalidate and refetch will be handled by react-query
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setProductDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    setDeleteProductId(id);
  };

  const confirmDelete = async () => {
    if (deleteProductId) {
      await deleteProduct.mutateAsync(deleteProductId);
      setDeleteProductId(null);
    }
  };

  const handleDialogClose = (open: boolean) => {
    setProductDialogOpen(open);
    if (!open) {
      setEditingProduct(null);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground">
              {isSuperAdmin 
                ? 'Super Admin: Manage all branches and inventory' 
                : isAdmin 
                  ? 'Manage your inventory and track stock levels' 
                  : 'View inventory and stock levels'}
            </p>
          </div>
          
          {isAdmin && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setUnitsDialogOpen(true)}>
                <Ruler className="mr-2 h-4 w-4" />
                Units
              </Button>
              <SuppliersDialog />
              <BrandsDialog />
              {isSuperAdmin && (
                <>
                  <Button variant="outline" onClick={() => setBranchesDialogOpen(true)}>
                    <MapPin className="mr-2 h-4 w-4" />
                    Branches
                  </Button>
                  <CustomersDialog />
                  <Button variant="outline" onClick={() => setUsersDialogOpen(true)}>
                    <Users className="mr-2 h-4 w-4" />
                    Manage Users
                  </Button>
                </>
              )}
              <Button onClick={() => setProductDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Product
              </Button>
            </div>
          )}
        </div>

        {/* Branch Filter */}
        {branches.length > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">Filter by branch:</span>
            <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All Branches" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Branches</SelectItem>
                {branches.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id}>
                    {branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Stats Cards */}
        <StatsCards 
          products={filteredProducts} 
          sales={filteredSales} 
          expenses={filteredExpenses} 
          hasBranchAccess={isSuperAdmin || myBranchAssignments.length > 0}
        />

        {/* Tabs for different views */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center gap-2">
              <History className="h-4 w-4" />
              History
            </TabsTrigger>
            <TabsTrigger value="forecast" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Forecast
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Products Table */}
            <ProductTable
              products={filteredProducts}
              onEdit={handleEdit}
              onDelete={handleDelete}
              isLoading={productsLoading}
              showBranch={branches.length > 0}
            />
          </TabsContent>

          <TabsContent value="history" className="space-y-6">
            {/* Stock History Table */}
            <StockHistoryTable limit={50} />
          </TabsContent>

          <TabsContent value="forecast" className="space-y-6">
            {/* Stock Forecast Charts */}
            <StockForecastChart />
          </TabsContent>
        </Tabs>
      </div>

      {/* Product Dialog */}
      <ProductDialog
        product={editingProduct}
        open={productDialogOpen}
        onOpenChange={handleDialogClose}
        allProducts={filteredProducts}
      />

      {/* Units Dialog */}
      <UnitsDialog
        open={unitsDialogOpen}
        onOpenChange={setUnitsDialogOpen}
      />

      {/* Branches Dialog */}
      <BranchesDialog
        open={branchesDialogOpen}
        onOpenChange={setBranchesDialogOpen}
      />

      {/* Users Management Dialog */}
      <UsersManagementDialog
        open={usersDialogOpen}
        onOpenChange={setUsersDialogOpen}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteProductId} onOpenChange={() => setDeleteProductId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this product? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
