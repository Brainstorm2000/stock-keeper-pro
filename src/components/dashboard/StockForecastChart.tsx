import { useState, useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Area, AreaChart } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { TrendingDown, AlertTriangle, Calendar, Search } from 'lucide-react';
import { useStockForecast, useStockTrends } from '@/hooks/useStockHistory';
import { useProducts } from '@/hooks/useProducts';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function StockForecastChart() {
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  
  const { data: products = [] } = useProducts();
  const { data: forecastData, isLoading: forecastLoading } = useStockForecast(selectedProductId, 30);
  const { data: trends, isLoading: trendsLoading } = useStockTrends(30);

  // Filter products by category and only include 'product' item_type (not services)
  const categoryProducts = useMemo(() => {
    let filtered = products.filter(p => p.item_type === 'product');
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(p => p.category === categoryFilter);
    }
    return filtered;
  }, [products, categoryFilter]);

  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return categoryProducts;
    return categoryProducts.filter(p => 
      p.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [categoryProducts, searchQuery]);

  const selectedProduct = useMemo(() => {
    return products.find(p => p.id === selectedProductId);
  }, [products, selectedProductId]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Stock Trends Chart */}
      <Card className="glass-card animate-fade-in">
        <CardHeader>
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-primary" />
            Stock Movement Trends
          </CardTitle>
          <CardDescription>Daily stock changes over the last 30 days</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            {trendsLoading ? (
              <Skeleton className="h-full w-full" />
            ) : trends && trends.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trends} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorChanges" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    tickFormatter={(value) => format(new Date(value), 'MMM d')}
                  />
                  <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                    labelFormatter={(value) => format(new Date(value), 'MMM d, yyyy')}
                    formatter={(value: number) => [value.toLocaleString(), 'Stock Movement']}
                  />
                  <Area
                    type="monotone"
                    dataKey="changes"
                    stroke="hsl(var(--primary))"
                    fillOpacity={1}
                    fill="url(#colorChanges)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                No trend data available
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Product Forecast Chart */}
      <Card className="glass-card animate-fade-in">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="text-lg font-semibold flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                Stock Forecast
              </CardTitle>
              <CardDescription>Projected stock levels for next 30 days</CardDescription>
            </div>
            
            {/* Category + Searchable Product Selector */}
            <div className="w-[240px] space-y-2">
              <Select value={categoryFilter} onValueChange={(v) => {
                setCategoryFilter(v);
                setSelectedProductId(''); // Reset selection when category changes
              }}>
                <SelectTrigger className="w-full h-9">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="sellable">Sellable</SelectItem>
                  <SelectItem value="consumable">Consumable</SelectItem>
                </SelectContent>
              </Select>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-9"
                />
              </div>
              <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a product..." />
                </SelectTrigger>
                <SelectContent>
                  {filteredProducts.length === 0 ? (
                    <div className="py-2 px-2 text-sm text-muted-foreground text-center">
                      No product found.
                    </div>
                  ) : (
                    filteredProducts.map((product) => (
                      <SelectItem key={product.id} value={product.id}>
                        {product.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!selectedProductId ? (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              Select a product to view forecast
            </div>
          ) : forecastLoading ? (
            <Skeleton className="h-[300px] w-full" />
          ) : forecastData ? (
            <div className="space-y-4">
              {/* Forecast Stats */}
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="flex items-center gap-1">
                  Current: {forecastData.currentStock.toLocaleString()}
                </Badge>
                <Badge variant="outline" className="flex items-center gap-1">
                  Avg. Daily Usage: {forecastData.avgDailyConsumption.toFixed(1)}
                </Badge>
                {forecastData.daysUntilLow !== null && forecastData.daysUntilLow > 0 && (
                  <Badge variant={forecastData.daysUntilLow <= 7 ? 'destructive' : 'secondary'} className="flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Low stock in {forecastData.daysUntilLow} days
                  </Badge>
                )}
              </div>

              {/* Forecast Chart */}
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={forecastData.forecast} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                      tickFormatter={(value) => format(new Date(value), 'MMM d')}
                    />
                    <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                      labelFormatter={(value) => format(new Date(value), 'MMM d, yyyy')}
                    />
                    <ReferenceLine 
                      y={forecastData.forecast[0]?.threshold || 0} 
                      stroke="hsl(var(--stock-low))" 
                      strokeDasharray="5 5"
                      label={{ value: 'Low Stock', fill: 'hsl(var(--stock-low))', fontSize: 11 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="projected"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={(props) => {
                        const { cx, cy, payload } = props;
                        if (payload.isHistorical) {
                          return (
                            <circle
                              cx={cx}
                              cy={cy}
                              r={6}
                              fill="hsl(var(--primary))"
                              stroke="hsl(var(--background))"
                              strokeWidth={2}
                            />
                          );
                        }
                        return (
                          <circle
                            cx={cx}
                            cy={cy}
                            r={4}
                            fill="hsl(var(--primary))"
                            fillOpacity={0.5}
                          />
                        );
                      }}
                      name="Projected Stock"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              Unable to generate forecast
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
