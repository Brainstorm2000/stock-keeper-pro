import { useMemo } from 'react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, FileText, Package, AlertTriangle, PackageX } from 'lucide-react';
import { BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { formatCurrency } from '@/lib/currency';
import { exportToCSV, exportToPDF } from '@/lib/export-utils';
import { useOrganization } from '@/hooks/useOrganization';

interface InventoryReportTabProps {
  products: any[];
  branches: any[];
  selectedBranch: string;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export function InventoryReportTab({ products, branches, selectedBranch }: InventoryReportTabProps) {
  const filteredProducts = useMemo(() => {
    return products.filter(p => selectedBranch === 'all' || p.branch_id === selectedBranch);
  }, [products, selectedBranch]);

  const totalItems = filteredProducts.length;
  const totalStock = filteredProducts.reduce((s, p) => s + Number(p.current_stock || 0), 0);
  const totalValue = filteredProducts.filter(p => p.category === 'sellable').reduce((s, p) => s + (Number(p.current_stock || 0) * Number(p.selling_price || 0)), 0);
  const totalCostValue = filteredProducts.reduce((s, p) => s + (Number(p.current_stock || 0) * Number(p.cost_price || 0)), 0);
  const lowStockItems = filteredProducts.filter(p => p.current_stock <= p.low_stock_threshold && p.current_stock > p.out_of_stock_threshold);
  const outOfStockItems = filteredProducts.filter(p => p.current_stock <= p.out_of_stock_threshold);

  // Stock by category
  const categoryData = useMemo(() => {
    const sellable = filteredProducts.filter(p => p.category === 'sellable');
    const consumable = filteredProducts.filter(p => p.category === 'consumable');
    return [
      { name: 'Sellable', count: sellable.length, value: sellable.reduce((s, p) => s + (Number(p.current_stock) * Number(p.selling_price)), 0) },
      { name: 'Consumable', count: consumable.length, value: consumable.reduce((s, p) => s + (Number(p.current_stock) * Number(p.cost_price)), 0) },
    ];
  }, [filteredProducts]);

  // Stock by branch
  const branchStock = useMemo(() => {
    const map: Record<string, { name: string; items: number; value: number }> = {};
    filteredProducts.forEach(p => {
      const branch = branches.find(b => b.id === p.branch_id);
      const name = branch?.name || 'Unknown';
      if (!map[name]) map[name] = { name, items: 0, value: 0 };
      map[name].items += Number(p.current_stock || 0);
      map[name].value += Number(p.current_stock || 0) * Number(p.cost_price || 0);
    });
    return Object.values(map).sort((a, b) => b.value - a.value);
  }, [filteredProducts, branches]);

  // Status distribution
  const statusData = useMemo(() => [
    { name: 'Normal', value: filteredProducts.filter(p => p.current_stock > p.low_stock_threshold).length },
    { name: 'Low Stock', value: lowStockItems.length },
    { name: 'Out of Stock', value: outOfStockItems.length },
  ], [filteredProducts, lowStockItems, outOfStockItems]);

  const handleExportCSV = () => {
    exportToCSV(filteredProducts.map(p => ({
      Name: p.name,
      SKU: p.sku || '-',
      Category: p.category,
      'Current Stock': p.current_stock,
      'Cost Price': p.cost_price,
      'Selling Price': p.selling_price,
      'Stock Value (Cost)': (p.current_stock * p.cost_price).toFixed(2),
      Branch: branches.find(b => b.id === p.branch_id)?.name || '-',
      Status: p.current_stock <= p.out_of_stock_threshold ? 'Out of Stock' : p.current_stock <= p.low_stock_threshold ? 'Low Stock' : 'Normal',
    })), 'inventory_report');
  };

  const handleExportPDF = () => {
    exportToPDF('Inventory Report', ['Product', 'SKU', 'Stock', 'Cost Price', 'Value', 'Status'],
      filteredProducts.map(p => [p.name, p.sku || '-', String(p.current_stock), formatCurrency(p.cost_price),
        formatCurrency(p.current_stock * p.cost_price),
        p.current_stock <= p.out_of_stock_threshold ? 'Out of Stock' : p.current_stock <= p.low_stock_threshold ? 'Low Stock' : 'Normal'
      ]),
      { 'Total Items': String(totalItems), 'Total Stock': String(totalStock), 'Total Value (Cost)': formatCurrency(totalCostValue), 'Selling Value': formatCurrency(totalValue) }
    );
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><Package className="h-3.5 w-3.5" /> Total Items</div>
          <p className="text-xl font-bold">{totalItems}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <div className="text-muted-foreground text-xs mb-1">Total Stock Units</div>
          <p className="text-xl font-bold">{totalStock.toLocaleString()}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><AlertTriangle className="h-3.5 w-3.5" /> Low Stock</div>
          <p className="text-xl font-bold text-warning">{lowStockItems.length}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4 pb-3">
          <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1"><PackageX className="h-3.5 w-3.5" /> Out of Stock</div>
          <p className="text-xl font-bold text-destructive">{outOfStockItems.length}</p>
        </CardContent></Card>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={handleExportCSV}><Download className="h-4 w-4 mr-1" /> CSV</Button>
        <Button variant="outline" size="sm" onClick={handleExportPDF}><FileText className="h-4 w-4 mr-1" /> PDF</Button>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader><CardTitle className="text-sm">Stock Status Distribution</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, value }) => `${name}: ${value}`}>
                  <Cell fill="hsl(var(--chart-2))" />
                  <Cell fill="hsl(var(--chart-4))" />
                  <Cell fill="hsl(var(--destructive))" />
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-sm">Stock Value by Branch</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={branchStock} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={100} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Low Stock / Out of Stock Table */}
      <Card>
        <CardHeader><CardTitle className="text-sm">Items Needing Attention ({lowStockItems.length + outOfStockItems.length})</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>Branch</TableHead>
                <TableHead className="text-right">Stock</TableHead>
                <TableHead className="text-right">Threshold</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...outOfStockItems, ...lowStockItems].map(p => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>{branches.find(b => b.id === p.branch_id)?.name || '-'}</TableCell>
                  <TableCell className="text-right">{p.current_stock}</TableCell>
                  <TableCell className="text-right">{p.low_stock_threshold}</TableCell>
                  <TableCell>
                    <Badge variant={p.current_stock <= p.out_of_stock_threshold ? 'destructive' : 'secondary'}>
                      {p.current_stock <= p.out_of_stock_threshold ? 'Out of Stock' : 'Low Stock'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {![...outOfStockItems, ...lowStockItems].length && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">All items are well-stocked</TableCell></TableRow>}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
