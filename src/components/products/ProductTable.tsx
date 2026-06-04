import { useState } from "react";
import { format } from "date-fns";
import {
  MoreHorizontal,
  Pencil,
  Trash2,
  Minus,
  Search,
  History,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { StatusBadge, getStockStatus } from "./StatusBadge";
import { StockUpdateDialog } from "./StockUpdateDialog";
import { PriceHistoryDialog } from "./PriceHistoryDialog";
import type { Product } from "@/hooks/useProducts";
import { useAuth } from "@/lib/auth";

interface ProductTableProps {
  products: Product[];
  onEdit: (product: Product) => void;
  onDelete: (id: string) => void;
  isLoading?: boolean;
  showBranch?: boolean;
}

export function ProductTable({
  products,
  onEdit,
  onDelete,
  isLoading,
  showBranch,
}: ProductTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "normal" | "low" | "out"
  >("all");
  const [categoryTab, setCategoryTab] = useState<
    "all" | "sellable" | "consumable"
  >("all");
  const [stockUpdateProduct, setStockUpdateProduct] = useState<Product | null>(
    null,
  );
  const [stockUpdateType, setStockUpdateType] = useState<
    "increase" | "decrease"
  >("increase");
  const [priceHistoryProduct, setPriceHistoryProduct] =
    useState<Product | null>(null);
  const { isAdmin } = useAuth();

  const filteredProducts = products.filter((product) => {
    const matchesSearch =
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.sku?.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    // Category filter
    if (categoryTab !== "all" && product.category !== categoryTab) return false;

    if (statusFilter === "all") return true;

    const status = getStockStatus(
      Number(product.current_stock),
      Number(product.low_stock_threshold),
      Number(product.out_of_stock_threshold),
      product.item_type,
    );

    return status === statusFilter;
  });

  const handleRemoveStock = (product: Product) => {
    setStockUpdateProduct(product);
    setStockUpdateType("decrease");
  };

  // Calculate stock value (current_stock * selling_price) for sellable items
  const calculateStockValue = (product: Product): number => {
    if (product.category === "sellable") {
      return Number(product.current_stock) * Number(product.selling_price);
    }
    return 0;
  };

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Calculate totals
  const sellableProducts = filteredProducts.filter(
    (p) => p.category === "sellable",
  );
  const consumableProducts = filteredProducts.filter(
    (p) => p.category === "consumable",
  );
  const totalStockValue = sellableProducts.reduce(
    (sum, p) => sum + calculateStockValue(p),
    0,
  );

  const renderProductRows = (productsToRender: Product[]) => {
    if (isLoading) {
      return (
        <TableRow>
          <TableCell
            colSpan={isAdmin ? (showBranch ? 9 : 8) : showBranch ? 8 : 7}
            className="text-center py-8"
          >
            <div className="animate-pulse-soft text-muted-foreground">
              Loading products...
            </div>
          </TableCell>
        </TableRow>
      );
    }

    if (productsToRender.length === 0) {
      return (
        <TableRow>
          <TableCell
            colSpan={isAdmin ? (showBranch ? 9 : 8) : showBranch ? 8 : 7}
            className="text-center py-8 text-muted-foreground"
          >
            {products.length === 0
              ? "No products yet. Add your first product!"
              : "No products match your filters."}
          </TableCell>
        </TableRow>
      );
    }

    return productsToRender.map((product) => {
      const status = getStockStatus(
        Number(product.current_stock),
        Number(product.low_stock_threshold),
        Number(product.out_of_stock_threshold),
        product.item_type,
      );
      const stockValue = calculateStockValue(product);

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
            <Badge
              variant={
                product.category === "sellable" ? "default" : "secondary"
              }
              className="text-xs"
            >
              {product.category === "sellable" ? "Sellable" : "Consumable"}
            </Badge>
            {product.item_type === "variable" && (
              <Badge variant="outline" className="text-[10px] ml-1">
                Variable
              </Badge>
            )}
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
              {product.branches?.name || "—"}
            </TableCell>
          )}
          <TableCell className="text-right font-semibold">
            {Number(product.current_stock).toLocaleString()}
          </TableCell>
          <TableCell className="text-right">
            {product.category === "sellable" ? (
              <span className="font-medium text-primary">
                {formatCurrency(stockValue)}
              </span>
            ) : (
              <span className="text-muted-foreground">—</span>
            )}
          </TableCell>
          <TableCell>
            <StatusBadge status={status} />
          </TableCell>
          <TableCell className="text-muted-foreground">
            {format(new Date(product.updated_at), "MMM d, yyyy HH:mm")}
          </TableCell>
          {isAdmin && (
            <TableCell>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {/* Only show Remove Stock for consumable products */}
                  {product.category === "consumable" && (
                    <DropdownMenuItem
                      onClick={() => handleRemoveStock(product)}
                    >
                      <Minus className="mr-2 h-4 w-4" />
                      Remove Stock
                    </DropdownMenuItem>
                  )}
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
    });
  };

  return (
    <>
      <Card
        className="glass-card animate-fade-in"
        style={{ animationDelay: "400ms" }}
      >
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <CardTitle className="text-lg font-semibold">Products</CardTitle>
              {categoryTab === "sellable" && sellableProducts.length > 0 && (
                <Badge variant="outline" className="text-sm font-medium">
                  Total Value: {formatCurrency(totalStockValue)}
                </Badge>
              )}
            </div>
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
                onChange={(e) =>
                  setStatusFilter(e.target.value as typeof statusFilter)
                }
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
          <Tabs
            value={categoryTab}
            onValueChange={(v) => setCategoryTab(v as typeof categoryTab)}
            className="mb-4"
          >
            <TabsList>
              <TabsTrigger value="all">All ({products.length})</TabsTrigger>
              <TabsTrigger value="sellable">
                Sellable (
                {products.filter((p) => p.category === "sellable").length})
              </TabsTrigger>
              <TabsTrigger value="consumable">
                Consumable (
                {products.filter((p) => p.category === "consumable").length})
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Unit</TableHead>
                  {showBranch && <TableHead>Branch</TableHead>}
                  <TableHead className="text-right">Current Stock</TableHead>
                  <TableHead className="text-right">Stock Value</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Updated</TableHead>
                  {isAdmin && (
                    <TableHead className="w-[100px]">Actions</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>{renderProductRows(filteredProducts)}</TableBody>
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

      <PriceHistoryDialog
        product={priceHistoryProduct}
        open={!!priceHistoryProduct}
        onOpenChange={(open) => !open && setPriceHistoryProduct(null)}
      />
    </>
  );
}
