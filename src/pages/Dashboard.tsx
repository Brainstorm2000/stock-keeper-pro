import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Ruler, Download, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatsCards } from '@/components/dashboard/StatsCards';
import { StockCharts } from '@/components/dashboard/StockCharts';
import { ProductTable } from '@/components/products/ProductTable';
import { ProductDialog } from '@/components/products/ProductDialog';
import { UnitsDialog } from '@/components/units/UnitsDialog';
import { useProducts, useDeleteProduct, type Product } from '@/hooks/useProducts';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/integrations/supabase/client';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Loader2 } from 'lucide-react';

export default function Dashboard() {
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [unitsDialogOpen, setUnitsDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deleteProductId, setDeleteProductId] = useState<string | null>(null);
  
  const { user, loading: authLoading, isAdmin } = useAuth();
  const { data: products = [], isLoading: productsLoading } = useProducts();
  const deleteProduct = useDeleteProduct();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

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
              {isAdmin ? 'Manage your inventory and track stock levels' : 'View inventory and stock levels'}
            </p>
          </div>
          
          {isAdmin && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => setUnitsDialogOpen(true)}>
                <Ruler className="mr-2 h-4 w-4" />
                Manage Units
              </Button>
              <Button onClick={() => setProductDialogOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Add Product
              </Button>
            </div>
          )}
        </div>

        {/* Stats Cards */}
        <StatsCards products={products} />

        {/* Charts */}
        <StockCharts products={products} />

        {/* Products Table */}
        <ProductTable
          products={products}
          onEdit={handleEdit}
          onDelete={handleDelete}
          isLoading={productsLoading}
        />
      </div>

      {/* Product Dialog */}
      <ProductDialog
        product={editingProduct}
        open={productDialogOpen}
        onOpenChange={handleDialogClose}
      />

      {/* Units Dialog */}
      <UnitsDialog
        open={unitsDialogOpen}
        onOpenChange={setUnitsDialogOpen}
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
