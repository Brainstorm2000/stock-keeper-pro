import { Package, AlertTriangle, XCircle, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import type { Product } from '@/hooks/useProducts';

interface StatsCardsProps {
  products: Product[];
}

function getStockStatus(product: Product) {
  if (product.current_stock <= product.out_of_stock_threshold) return 'out';
  if (product.current_stock <= product.low_stock_threshold) return 'low';
  return 'normal';
}

export function StatsCards({ products }: StatsCardsProps) {
  const totalProducts = products.length;
  const lowStockCount = products.filter(p => getStockStatus(p) === 'low').length;
  const outOfStockCount = products.filter(p => getStockStatus(p) === 'out').length;
  const normalCount = products.filter(p => getStockStatus(p) === 'normal').length;

  const stats = [
    {
      title: 'Total Products',
      value: totalProducts,
      icon: Package,
      color: 'text-primary',
      bgColor: 'bg-primary/10',
    },
    {
      title: 'In Stock',
      value: normalCount,
      icon: TrendingUp,
      color: 'text-stock-normal',
      bgColor: 'bg-stock-normal/10',
    },
    {
      title: 'Low Stock',
      value: lowStockCount,
      icon: AlertTriangle,
      color: 'text-stock-low',
      bgColor: 'bg-stock-low/10',
    },
    {
      title: 'Out of Stock',
      value: outOfStockCount,
      icon: XCircle,
      color: 'text-stock-out',
      bgColor: 'bg-stock-out/10',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, index) => (
        <Card 
          key={stat.title} 
          className="glass-card animate-fade-in"
          style={{ animationDelay: `${index * 100}ms` }}
        >
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{stat.title}</p>
                <p className="text-3xl font-bold text-foreground mt-1">{stat.value}</p>
              </div>
              <div className={`h-12 w-12 rounded-xl ${stat.bgColor} flex items-center justify-center`}>
                <stat.icon className={`h-6 w-6 ${stat.color}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
