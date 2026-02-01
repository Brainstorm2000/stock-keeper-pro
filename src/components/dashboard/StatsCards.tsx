import { Package, AlertTriangle, XCircle, TrendingUp, TrendingDown, DollarSign, Receipt, ShoppingCart, Layers } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Product } from '@/hooks/useProducts';
import type { Sale } from '@/hooks/useSales';
import type { Expense } from '@/hooks/useExpenses';

interface StatsCardsProps {
  products: Product[];
  sales?: Sale[];
  expenses?: Expense[];
}

function getStockStatus(product: Product) {
  if (product.current_stock <= product.out_of_stock_threshold) return 'out';
  if (product.current_stock <= product.low_stock_threshold) return 'low';
  return 'normal';
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function StatsCards({ products, sales = [], expenses = [] }: StatsCardsProps) {
  // Separate sellables and consumables
  const sellableProducts = products.filter(p => p.category === 'sellable');
  const consumableProducts = products.filter(p => p.category === 'consumable');

  // Sellable stats
  const sellableLowStock = sellableProducts.filter(p => getStockStatus(p) === 'low').length;
  const sellableOutOfStock = sellableProducts.filter(p => getStockStatus(p) === 'out').length;
  const sellableNormal = sellableProducts.filter(p => getStockStatus(p) === 'normal').length;

  // Consumable stats
  const consumableLowStock = consumableProducts.filter(p => getStockStatus(p) === 'low').length;
  const consumableOutOfStock = consumableProducts.filter(p => getStockStatus(p) === 'out').length;
  const consumableNormal = consumableProducts.filter(p => getStockStatus(p) === 'normal').length;

  // Financial calculations (completed sales only)
  const completedSales = sales.filter(s => s.status === 'completed');
  const totalRevenue = completedSales.reduce((sum, s) => sum + Number(s.total_amount), 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  
  // Calculate gross profit from sale items (revenue - cost of goods sold)
  // For now, estimate using the difference between selling and cost prices in products
  const grossProfit = totalRevenue - totalExpenses;
  const isProfit = grossProfit >= 0;

  return (
    <div className="space-y-6">
      {/* Financial Overview */}
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-3">Financial Overview</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="glass-card animate-fade-in">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Sales</p>
                  <p className="text-2xl font-bold text-foreground mt-1">{formatCurrency(totalRevenue)}</p>
                  <p className="text-xs text-muted-foreground mt-1">{completedSales.length} transactions</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <ShoppingCart className="h-6 w-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card animate-fade-in" style={{ animationDelay: '100ms' }}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Expenses</p>
                  <p className="text-2xl font-bold text-foreground mt-1">{formatCurrency(totalExpenses)}</p>
                  <p className="text-xs text-muted-foreground mt-1">{expenses.length} records</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-destructive/10 flex items-center justify-center">
                  <Receipt className="h-6 w-6 text-destructive" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card animate-fade-in" style={{ animationDelay: '200ms' }}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">{isProfit ? 'Net Profit' : 'Net Loss'}</p>
                  <p className={`text-2xl font-bold mt-1 ${isProfit ? 'text-stock-normal' : 'text-destructive'}`}>
                    {formatCurrency(Math.abs(grossProfit))}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Sales - Expenses</p>
                </div>
                <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${isProfit ? 'bg-stock-normal/10' : 'bg-destructive/10'}`}>
                  {isProfit ? (
                    <TrendingUp className="h-6 w-6 text-stock-normal" />
                  ) : (
                    <TrendingDown className="h-6 w-6 text-destructive" />
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card animate-fade-in" style={{ animationDelay: '300ms' }}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Items</p>
                  <p className="text-2xl font-bold text-foreground mt-1">{products.length}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {sellableProducts.length} sellable, {consumableProducts.length} consumable
                  </p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Package className="h-6 w-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Sellable Products Stats */}
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
          <ShoppingCart className="h-5 w-5" />
          Sellable Products
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="glass-card animate-fade-in">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">In Stock</p>
                  <p className="text-3xl font-bold text-foreground mt-1">{sellableNormal}</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-stock-normal/10 flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-stock-normal" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card animate-fade-in" style={{ animationDelay: '100ms' }}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Low Stock</p>
                  <p className="text-3xl font-bold text-foreground mt-1">{sellableLowStock}</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-stock-low/10 flex items-center justify-center">
                  <AlertTriangle className="h-6 w-6 text-stock-low" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card animate-fade-in" style={{ animationDelay: '200ms' }}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Out of Stock</p>
                  <p className="text-3xl font-bold text-foreground mt-1">{sellableOutOfStock}</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-stock-out/10 flex items-center justify-center">
                  <XCircle className="h-6 w-6 text-stock-out" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Consumable Products Stats */}
      <div>
        <h3 className="text-lg font-semibold text-foreground mb-3 flex items-center gap-2">
          <Layers className="h-5 w-5" />
          Consumable Products
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="glass-card animate-fade-in">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">In Stock</p>
                  <p className="text-3xl font-bold text-foreground mt-1">{consumableNormal}</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-stock-normal/10 flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-stock-normal" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card animate-fade-in" style={{ animationDelay: '100ms' }}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Low Stock</p>
                  <p className="text-3xl font-bold text-foreground mt-1">{consumableLowStock}</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-stock-low/10 flex items-center justify-center">
                  <AlertTriangle className="h-6 w-6 text-stock-low" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card animate-fade-in" style={{ animationDelay: '200ms' }}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Out of Stock</p>
                  <p className="text-3xl font-bold text-foreground mt-1">{consumableOutOfStock}</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-stock-out/10 flex items-center justify-center">
                  <XCircle className="h-6 w-6 text-stock-out" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
