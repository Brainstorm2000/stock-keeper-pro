import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { Product } from '@/hooks/useProducts';

interface StockChartsProps {
  products: Product[];
}

function getStockStatus(product: Product) {
  // Services don't have stock constraints - always available
  if (product.item_type === 'service') return 'normal';
  
  if (product.current_stock <= product.out_of_stock_threshold) return 'out';
  if (product.current_stock <= product.low_stock_threshold) return 'low';
  return 'normal';
}

export function StockCharts({ products }: StockChartsProps) {
  // Bar chart data - top 10 products by stock
  const barChartData = products
    .slice(0, 10)
    .map(p => ({
      name: p.name.length > 15 ? p.name.substring(0, 15) + '...' : p.name,
      stock: Number(p.current_stock),
      threshold: Number(p.low_stock_threshold),
    }));

  // Pie chart data - stock status distribution
  const normalCount = products.filter(p => getStockStatus(p) === 'normal').length;
  const lowCount = products.filter(p => getStockStatus(p) === 'low').length;
  const outCount = products.filter(p => getStockStatus(p) === 'out').length;

  const pieChartData = [
    { name: 'Normal', value: normalCount, color: 'hsl(142, 71%, 45%)' },
    { name: 'Low Stock', value: lowCount, color: 'hsl(38, 92%, 50%)' },
    { name: 'Out of Stock', value: outCount, color: 'hsl(0, 84%, 60%)' },
  ].filter(d => d.value > 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="glass-card animate-fade-in" style={{ animationDelay: '200ms' }}>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Stock Levels by Product</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            {barChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barChartData} margin={{ top: 10, right: 10, left: 0, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    angle={-45}
                    textAnchor="end"
                    height={60}
                  />
                  <YAxis tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar 
                    dataKey="stock" 
                    fill="hsl(var(--primary))" 
                    radius={[4, 4, 0, 0]}
                    name="Current Stock"
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                No products to display
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card animate-fade-in" style={{ animationDelay: '300ms' }}>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Stock Status Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            {pieChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    labelLine={false}
                  >
                    {pieChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                No products to display
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
