import { useMemo, useState } from "react";
import { format } from "date-fns";
import {
  MoreHorizontal,
  Pencil,
  Trash2,
  Minus,
  Search,
  History,
  Download,
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { StatusBadge, getStockStatus } from "./StatusBadge";
import { StockUpdateDialog } from "./StockUpdateDialog";
import { PriceHistoryDialog } from "./PriceHistoryDialog";
import { BulkEditProductsDialog } from "./BulkEditProductsDialog";
import { useBulkDeleteProducts, type Product } from "@/hooks/useProducts";
import { useBranches } from "@/hooks/useBranches";
import { useSuppliers } from "@/hooks/useSuppliers";
import { useBrands } from "@/hooks/useBrands";
import { exportProductsToCSV, downloadCSV } from "@/lib/csv-utils";
import { useAuth } from "@/lib/auth";
import { useModuleAccess } from "@/components/access/ModuleAccessGuard";

interface ProductTableProps {
  products: Product[];
  onEdit: (product: Product) => void;
  onDelete: (id: string) => void;
  isLoading?: boolean;
  showBranch?: boolean;
  searchQuery?: string;
  onSearchQueryChange?: (value: string) => void;
  statusFilter?: "all" | "normal" | "low" | "out";
  onStatusFilterChange?: (value: "all" | "normal" | "low" | "out") => void;
  categoryTab?: "all" | "sellable" | "consumable";
  onCategoryTabChange?: (value: "all" | "sellable" | "consumable") => void;
  categoryCounts?: {
    all: number;
    sellable: number;
    consumable: number;
  };
  totalSellableStockValue?: number;
}

export function ProductTable({
  products,
  onEdit,
  onDelete,
  isLoading,
  showBranch,
  searchQuery,
  onSearchQueryChange,
  statusFilter,
  onStatusFilterChange,
  categoryTab,
  onCategoryTabChange,
  categoryCounts,
  totalSellableStockValue,
}: ProductTableProps) {
  const { canEdit: canEditProduct, canDelete: canDeleteProduct } =
    useModuleAccess("products");
  const [internalSearchQuery, setInternalSearchQuery] = useState("");
  const [internalStatusFilter, setInternalStatusFilter] = useState<
    "all" | "normal" | "low" | "out"
  >("all");
  const [internalCategoryTab, setInternalCategoryTab] = useState<
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkEditOpen, setBulkEditOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const bulkDelete = useBulkDeleteProducts();
  const { data: branchesAll = [] } = useBranches();
  const { data: suppliersAll = [] } = useSuppliers();
  const { data: brandsAll = [] } = useBrands();

  const effectiveSearchQuery =
    searchQuery !== undefined ? searchQuery : internalSearchQuery;
  const effectiveStatusFilter =
    statusFilter !== undefined ? statusFilter : internalStatusFilter;
  const effectiveCategoryTab =
    categoryTab !== undefined ? categoryTab : internalCategoryTab;

  const isControlled =
    onSearchQueryChange !== undefined ||
    onStatusFilterChange !== undefined ||
    onCategoryTabChange !== undefined;

  const filteredProducts = useMemo(() => {
    if (isControlled) return products;

    return products.filter((product) => {
      const matchesSearch =
        product.name.toLowerCase().includes(effectiveSearchQuery.toLowerCase()) ||
        product.sku?.toLowerCase().includes(effectiveSearchQuery.toLowerCase());

      if (!matchesSearch) return false;

      // Category filter
      if (effectiveCategoryTab !== "all" && product.category !== effectiveCategoryTab)
        return false;

      if (effectiveStatusFilter === "all") return true;

      const status = getStockStatus(
        Number(product.current_stock),
        Number(product.low_stock_threshold),
        Number(product.out_of_stock_threshold),
        product.item_type,
      );

      return status === effectiveStatusFilter;
    });
  }, [products, isControlled, effectiveSearchQuery, effectiveStatusFilter, effectiveCategoryTab]);

  const productsToRender = isControlled ? products : filteredProducts;
  const visibleSelectableIds = productsToRender.map((p) => p.id);
  const allVisibleSelected =
    visibleSelectableIds.length > 0 &&
    visibleSelectableIds.every((id) => selectedIds.has(id));
  const someVisibleSelected =
    visibleSelectableIds.some((id) => selectedIds.has(id)) &&
    !allVisibleSelected;

  const toggleAllVisible = (checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) visibleSelectableIds.forEach((id) => next.add(id));
      else visibleSelectableIds.forEach((id) => next.delete(id));
      return next;
    });
  };

  const toggleOne = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const selectedProducts = products.filter((p) => selectedIds.has(p.id));

  const handleBulkExport = () => {
    const csv = exportProductsToCSV(
      selectedProducts,
      branchesAll,
      suppliersAll,
      brandsAll,
    );
    const date = new Date().toISOString().split("T")[0];
    downloadCSV(csv, `products_selected_${date}.csv`);
  };

  const handleBulkDelete = async () => {
    await bulkDelete.mutateAsync(Array.from(selectedIds));
    clearSelection();
    setBulkDeleteOpen(false);
  };

  const handleRemoveStock = (product: Product) => {
    setStockUpdateProduct(product);
    setStockUpdateType("decrease");
  };

  // Calculate stock value (current_stock * selling_price) for sellable items
  const calculateStockValue = (product: Product): number => {
    if (product.category !== "sellable") return 0;
    if (product.item_type === "variable" && product.variations?.length) {
      return product.variations.reduce(
        (sum, v) => sum + Number(v.current_stock) * Number(v.selling_price),
        0,
      );
    }
    return Number(product.current_stock) * Number(product.selling_price);
  };

  const getDisplayStock = (product: Product): number => {
    if (product.item_type === "variable" && product.variations?.length) {
      return product.variations.reduce(
        (sum, v) => sum + Number(v.current_stock),
        0,
      );
    }
    return Number(product.current_stock);
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
  const totalStockValue =
    totalSellableStockValue !== undefined
      ? totalSellableStockValue
      : sellableProducts.reduce((sum, p) => sum + calculateStockValue(p), 0);

  const renderProductRows = (productsToRender: Product[]) => {
    const baseCols = (isAdmin ? (showBranch ? 9 : 8) : showBranch ? 8 : 7) + (isAdmin ? 1 : 0);
    if (isLoading) {
      return (
        <TableRow>
          <TableCell
            colSpan={baseCols}
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
            colSpan={baseCols}
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
          {isAdmin && (
            <TableCell className="w-[40px]">
              <Checkbox
                checked={selectedIds.has(product.id)}
                onCheckedChange={(c) => toggleOne(product.id, !!c)}
                aria-label={`Select ${product.name}`}
              />
            </TableCell>
          )}
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
            {getDisplayStock(product).toLocaleString()}
            {product.item_type === "variable" && (
              <span className="block text-[10px] text-muted-foreground font-normal">
                {product.variations?.length || 0} variation
                {(product.variations?.length || 0) === 1 ? "" : "s"}
              </span>
            )}
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
                   {canEditProduct && (
                     <DropdownMenuItem onClick={() => onEdit(product)}>
                       <Pencil className="mr-2 h-4 w-4" />
                       Edit
                     </DropdownMenuItem>
                   )}

                   {canDeleteProduct && (
                     <DropdownMenuItem
                       onClick={() => onDelete(product.id)}
                       className="text-destructive"
                     >
                       <Trash2 className="mr-2 h-4 w-4" />
                       Delete
                     </DropdownMenuItem>
                   )}
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
              {effectiveCategoryTab === "sellable" &&
                (categoryCounts?.sellable ?? sellableProducts.length) > 0 && (
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
                  value={effectiveSearchQuery}
                  onChange={(e) =>
                    onSearchQueryChange
                      ? onSearchQueryChange(e.target.value)
                      : setInternalSearchQuery(e.target.value)
                  }
                  className="pl-9 w-full sm:w-64"
                />
              </div>
              <select
                value={effectiveStatusFilter}
                onChange={(e) => {
                  const next = e.target.value as typeof effectiveStatusFilter;
                  if (onStatusFilterChange) {
                    onStatusFilterChange(next);
                  } else {
                    setInternalStatusFilter(next);
                  }
                }}
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
          {isAdmin && selectedIds.size > 0 && (
            <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-md border bg-muted/40 px-4 py-2">
              <div className="text-sm font-medium">
                {selectedIds.size} selected
              </div>
              <div className="flex flex-wrap gap-2">
                {canEditProduct && (
                  <Button size="sm" variant="outline" onClick={() => setBulkEditOpen(true)}>
                    <Pencil className="mr-2 h-4 w-4" /> Bulk Edit
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={handleBulkExport}>
                  <Download className="mr-2 h-4 w-4" /> Export Selected
                </Button>
                {canDeleteProduct && (
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => setBulkDeleteOpen(true)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" /> Delete Selected
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={clearSelection}>
                  Clear
                </Button>
              </div>
            </div>
          )}

          <Tabs
            value={effectiveCategoryTab}
            onValueChange={(v) => {
              const next = v as typeof effectiveCategoryTab;
              if (onCategoryTabChange) {
                onCategoryTabChange(next);
              } else {
                setInternalCategoryTab(next);
              }
            }}
            className="mb-4"
          >
            <TabsList>
              <TabsTrigger value="all">
                All ({categoryCounts?.all ?? products.length})
              </TabsTrigger>
              <TabsTrigger value="sellable">
                Sellable (
                {categoryCounts?.sellable ??
                  products.filter((p) => p.category === "sellable").length})
              </TabsTrigger>
              <TabsTrigger value="consumable">
                Consumable (
                {categoryCounts?.consumable ??
                  products.filter((p) => p.category === "consumable").length})
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  {isAdmin && (
                    <TableHead className="w-[40px]">
                      <Checkbox
                        checked={
                          allVisibleSelected
                            ? true
                            : someVisibleSelected
                            ? "indeterminate"
                            : false
                        }
                        onCheckedChange={(c) => toggleAllVisible(!!c)}
                        aria-label="Select all"
                      />
                    </TableHead>
                  )}
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
              <TableBody>{renderProductRows(productsToRender)}</TableBody>
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

      <BulkEditProductsDialog
        open={bulkEditOpen}
        onOpenChange={setBulkEditOpen}
        selectedIds={Array.from(selectedIds)}
        onDone={clearSelection}
      />

      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selectedIds.size} products?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. Products linked to existing
              transactions may fail to delete.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleBulkDelete();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
