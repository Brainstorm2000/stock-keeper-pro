import { useState } from 'react';
import { format } from 'date-fns';
import { MoreHorizontal, Pencil, Trash2, Plus, Minus, Search } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge, getStockStatus } from './StatusBadge';
import { StockUpdateDialog } from './StockUpdateDialog';
import type { Product } from '@/hooks/useProducts';
import { useAuth } from '@/lib/auth';

interface ProductTableProps {
  products: Product[];
  onEdit: (product: Product) => void;
  onDelete: (id: string) => void;
  isLoading?: boolean;
  showBranch?: boolean;
}

export function ProductTable({ products, onEdit, onDelete, isLoading, showBranch }: ProductTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'normal' | 'low' | 'out'>('all');
  const [stockUpdateProduct, setStockUpdateProduct] = useState<Product | null>(null);
  const [stockUpdateType, setStockUpdateType] = useState<'increase' | 'decrease'>('increase');
  const { isAdmin } = useAuth();

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.sku?.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchesSearch) return false;
    
    if (statusFilter === 'all') return true;
    
    const status = getStockStatus(
      Number(product.current_stock),
      Number(product.low_stock_threshold),
      Number(product.out_of_stock_threshold)
    );
    
    return status === statusFilter;
  });

  const handleStockUpdate = (product: Product, type: 'increase' | 'decrease') => {
    setStockUpdateProduct(product);
    setStockUpdateType(type);
  };

  return (
    <>
      <Card className="glass-card animate-fade-in" style={{ animationDelay: '400ms' }}>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <CardTitle className="text-lg font-semibold">Products</CardTitle>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 w-full sm:w-64"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="all">All Status</option>
                <option value="normal">In Stock</option>
                <option value="low">Low Stock</option>
                <option value="out">Out of Stock</option>
              </select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product Name</TableHead>
                  <TableHead>Unit</TableHead>
                  {showBranch && <TableHead>Branch</TableHead>}
                  <TableHead className="text-right">Opening</TableHead>
                  <TableHead className="text-right">Current</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Updated</TableHead>
                  {isAdmin && <TableHead className="w-[100px]">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? (showBranch ? 9 : 8) : (showBranch ? 8 : 7)} className="text-center py-8">
                      <div className="animate-pulse-soft text-muted-foreground">Loading products...</div>
                    </TableCell>
                  </TableRow>
                ) : filteredProducts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={isAdmin ? (showBranch ? 9 : 8) : (showBranch ? 8 : 7)} className="text-center py-8 text-muted-foreground">
                      {products.length === 0 ? 'No products yet. Add your first product!' : 'No products match your search.'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredProducts.map((product) => {
                    const status = getStockStatus(
                      Number(product.current_stock),
                      Number(product.low_stock_threshold),
                      Number(product.out_of_stock_threshold)
                    );

                    return (
                      <TableRow key={product.id} className="group">
                        <TableCell className="font-medium">
                          <div>
                            {product.name}
                            {product.sku && (
                              <span className="block text-xs text-muted-foreground">
                                SKU: {product.sku}
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {product.units?.name}
                          {product.units?.abbreviation && (
                            <span className="text-muted-foreground ml-1">
                              ({product.units.abbreviation})
                            </span>
                          )}
                        </TableCell>
                        {showBranch && (
                          <TableCell className="text-muted-foreground">
                            {product.branches?.name || '—'}
                          </TableCell>
                        )}
                        <TableCell className="text-right">{Number(product.opening_stock).toLocaleString()}</TableCell>
                        <TableCell className="text-right font-semibold">{Number(product.current_stock).toLocaleString()}</TableCell>
                        <TableCell>
                          <StatusBadge status={status} />
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(product.updated_at), 'MMM d, yyyy HH:mm')}
                        </TableCell>
                        {isAdmin && (
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => handleStockUpdate(product, 'increase')}>
                                  <Plus className="mr-2 h-4 w-4" />
                                  Add Stock
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleStockUpdate(product, 'decrease')}>
                                  <Minus className="mr-2 h-4 w-4" />
                                  Remove Stock
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onEdit(product)}>
                                  <Pencil className="mr-2 h-4 w-4" />
                                  Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => onDelete(product.id)}
                                  className="text-destructive"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        )}
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {stockUpdateProduct && (
        <StockUpdateDialog
          product={stockUpdateProduct}
          type={stockUpdateType}
          open={!!stockUpdateProduct}
          onOpenChange={(open) => !open && setStockUpdateProduct(null)}
        />
      )}
    </>
  );
}
