import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Ruler,
  MapPin,
  Users,
  History,
  TrendingUp,
  Settings2,
  Filter,
  Loader2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  CreditCard,
} from "lucide-react";

// UI Components
import { Button } from "@/components/ui/button";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { StatsCards } from "@/components/dashboard/StatsCards";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

// Dialogs & Tables
import { StockHistoryTable } from "@/components/dashboard/StockHistoryTable";
import { StockForecastChart } from "@/components/dashboard/StockForecastChart";
import { ProductTable } from "@/components/products/ProductTable";
import { ProductDialog } from "@/components/products/ProductDialog";
import { UnitsDialog } from "@/components/units/UnitsDialog";
import { getStockStatus } from "@/components/products/StatusBadge";
import { BranchesDialog } from "@/components/branches/BranchesDialog";
import { UsersManagementDialog } from "@/components/users/UsersManagementDialog";
import { CustomersDialog } from "@/components/customers/CustomersDialog";
import { SuppliersDialog } from "@/components/suppliers/SuppliersDialog";
import { BrandsDialog } from "@/components/brands/BrandsDialog";
import { PaymentMethodsDialog } from "@/components/organization/PaymentMethodsDialog";

// Hooks & Logic
import {
  useProducts,
  useDeleteProduct,
  type Product,
} from "@/hooks/useProducts";
import { useBranches, useMyBranchAssignments } from "@/hooks/useBranches";
import { useSales } from "@/hooks/useSales";
import { useExpenses } from "@/hooks/useExpenses";
import { useOutstandingSales } from "@/hooks/useDebts";
import { useAuth } from "@/lib/auth";
import { useModuleAccess } from "@/components/access/ModuleAccessGuard";

export default function Dashboard() {
  const navigate = useNavigate();
  const {
    user,
    loading: authLoading,
    isAdmin,
    isSuperAdmin,
    isSuperSuperAdmin,
    hasCompletedOnboarding,
    isOrgDisabled,
  } = useAuth();
  const { canCreate: canCreateProduct, canDelete: canDeleteProduct } =
    useModuleAccess("products");
  const { canView: canViewFinancials } = useModuleAccess("dashboard_financials");

  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [unitsDialogOpen, setUnitsDialogOpen] = useState(false);
  const [branchesDialogOpen, setBranchesDialogOpen] = useState(false);
  const [usersDialogOpen, setUsersDialogOpen] = useState(false);
  const [paymentMethodsOpen, setPaymentMethodsOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deleteProductId, setDeleteProductId] = useState<string | null>(null);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("all");
  const [productSearchQuery, setProductSearchQuery] = useState("");
  const [productStatusFilter, setProductStatusFilter] = useState<
    "all" | "normal" | "low" | "out"
  >("all");
  const [productCategoryTab, setProductCategoryTab] = useState<
    "all" | "sellable" | "consumable"
  >("all");
  const [showArchived, setShowArchived] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const { data: products = [], isLoading: productsLoading } = useProducts({
    includeArchived: true,
  });
  const { data: branches = [] } = useBranches();
  const { data: myBranchAssignments = [] } = useMyBranchAssignments();
  const { data: sales = [] } = useSales();
  const { data: expenses = [] } = useExpenses();
  const { data: outstandingSales = [] } = useOutstandingSales();
  const deleteProduct = useDeleteProduct();

  const branchFilteredProducts = useMemo(
    () =>
      selectedBranchId === "all"
        ? products
        : products.filter((p) => p.branch_id === selectedBranchId),
    [products, selectedBranchId],
  );

  const archiveFilteredProducts = useMemo(
    () =>
      showArchived
        ? branchFilteredProducts.filter((p) => p.is_archived)
        : branchFilteredProducts.filter((p) => !p.is_archived),
    [branchFilteredProducts, showArchived],
  );

  const filteredBySearchAndStatus = useMemo(() => {
    const query = productSearchQuery.trim().toLowerCase();

    return archiveFilteredProducts.filter((product) => {
      const matchesSearch =
        !query ||
        product.name.toLowerCase().includes(query) ||
        product.sku?.toLowerCase().includes(query);

      if (!matchesSearch) return false;

      if (productStatusFilter !== "all") {
        const status = getStockStatus(
          Number(product.current_stock),
          Number(product.low_stock_threshold),
          Number(product.out_of_stock_threshold),
          product.item_type,
        );
        return status === productStatusFilter;
      }

      return true;
    });
  }, [archiveFilteredProducts, productSearchQuery, productStatusFilter]);

  const categoryCounts = useMemo(
    () => ({
      all: filteredBySearchAndStatus.length,
      sellable: filteredBySearchAndStatus.filter(
        (p) => p.category === "sellable",
      ).length,
      consumable: filteredBySearchAndStatus.filter(
        (p) => p.category === "consumable",
      ).length,
    }),
    [filteredBySearchAndStatus],
  );

  const filteredProducts = useMemo(
    () =>
      productCategoryTab === "all"
        ? filteredBySearchAndStatus
        : filteredBySearchAndStatus.filter(
            (p) => p.category === productCategoryTab,
          ),
    [filteredBySearchAndStatus, productCategoryTab],
  );

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const paginatedProducts = filteredProducts.slice(
    indexOfFirstItem,
    indexOfLastItem,
  );

  const filteredSellableStockValue = useMemo(
    () =>
      filteredBySearchAndStatus
        .filter((p) => p.category === "sellable")
        .reduce((sum, product) => {
          if (product.item_type === "variable" && product.variations?.length) {
            return (
              sum +
              product.variations.reduce(
                (inner, variation) =>
                  inner +
                  Number(variation.current_stock) * Number(variation.selling_price),
                0,
              )
            );
          }
          return sum + Number(product.current_stock) * Number(product.selling_price);
        }, 0),
    [filteredBySearchAndStatus],
  );

  const filteredSales =
    selectedBranchId === "all"
      ? sales
      : sales.filter((s) => s.branch_id === selectedBranchId);
  const filteredExpenses =
    selectedBranchId === "all"
      ? expenses
      : expenses.filter((e) => e.branch_id === selectedBranchId);
  const filteredOutstandingSales =
    selectedBranchId === "all"
      ? outstandingSales
      : outstandingSales.filter((s: any) => s.branch_id === selectedBranchId);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedBranchId, productSearchQuery, productStatusFilter, productCategoryTab]);

  useEffect(() => {
    if (!authLoading) {
      if (!user || hasCompletedOnboarding === false || isOrgDisabled) {
        navigate("/auth");
      } else if (isSuperSuperAdmin) {
        navigate("/admin");
      }
    }
  }, [
    user,
    authLoading,
    hasCompletedOnboarding,
    isSuperSuperAdmin,
    isOrgDisabled,
    navigate,
  ]);

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setProductDialogOpen(true);
  };

  const handleDelete = (id: string) => setDeleteProductId(id);

  const confirmDelete = async () => {
    if (deleteProductId) {
      await deleteProduct.mutateAsync(deleteProductId);
      setDeleteProductId(null);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#020817]">
        <Loader2 className="h-10 w-10 animate-spin text-[#FF9E3D]" />
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 md:space-y-8 max-w-[1600px] mx-auto animate-in fade-in duration-500 px-4 md:px-0">
        {/* --- Responsive Header --- */}
        <div className="flex flex-col gap-6 border-b border-slate-100 dark:border-slate-800 pb-6 md:flex-row md:items-end md:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-[#000B26] dark:text-white">
              Inventory Dashboard
            </h1>
            <p className="text-sm md:text-base text-slate-500 dark:text-slate-400 font-medium">
              {isSuperAdmin
                ? "Enterprise Oversight & Branch Management"
                : "Real-time stock tracking and analytics"}
            </p>
          </div>

          {(isAdmin || canCreateProduct) && (
            <div className="grid grid-cols-2 gap-3 w-full md:flex md:w-auto">
              {isAdmin && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full md:w-auto font-bold border-slate-200 dark:border-slate-800"
                  >
                    <Settings2 className="mr-2 h-4 w-4" /> Setup
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuItem onClick={() => setUnitsDialogOpen(true)}>
                    <Ruler className="mr-2 h-4 w-4" /> Units
                  </DropdownMenuItem>
                  <SuppliersDialog />
                  <BrandsDialog />
                  <DropdownMenuItem onClick={() => setPaymentMethodsOpen(true)}>
                    <CreditCard className="mr-2 h-4 w-4" /> Payment Methods
                  </DropdownMenuItem>
                  {isSuperAdmin && (
                    <>
                      <DropdownMenuItem
                        onClick={() => setBranchesDialogOpen(true)}
                      >
                        <MapPin className="mr-2 h-4 w-4" /> Branches
                      </DropdownMenuItem>
                      <CustomersDialog />
                      <DropdownMenuItem
                        onClick={() => setUsersDialogOpen(true)}
                      >
                        <Users className="mr-2 h-4 w-4" /> Team
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              )}

              {canCreateProduct && (
                <Button
                  onClick={() => setProductDialogOpen(true)}
                  className="w-full sm:w-auto bg-[#FF9E3D] hover:bg-[#e88d30] text-[#000B26] font-bold shadow-md shadow-amber-500/10 transition-all active:scale-[0.98]"
                >
                  <Plus className="mr-2 h-4 w-4" /> Product
                </Button>
              )}
            </div>
          )}
        </div>

        {/* --- Responsive Filter --- */}
        <div className="flex flex-col gap-3 p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 md:flex-row md:items-center">
          <div className="flex items-center gap-2 px-1 text-[10px] font-black text-slate-400 uppercase tracking-widest md:px-3">
            <Filter className="h-3 w-3" /> Branch Filter
          </div>
          <Select value={selectedBranchId} onValueChange={setSelectedBranchId}>
            <SelectTrigger className="w-full md:w-[240px] bg-slate-50 dark:bg-slate-950 border-none font-semibold">
              <SelectValue placeholder="All Branches" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Branches</SelectItem>
              {branches.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant={showArchived ? "default" : "outline"}
            size="sm"
            onClick={() => setShowArchived((v) => !v)}
            className="md:ml-auto"
          >
            {showArchived ? "Showing archived" : "Show archived"}
          </Button>
        </div>

        {/* --- Stats Cards (Handled within component but wrapped for padding) --- */}
        <div className="overflow-x-hidden">
          <StatsCards
            products={filteredProducts}
            sales={filteredSales}
            expenses={filteredExpenses}
            outstandingSales={filteredOutstandingSales}
            hasBranchAccess={
              (isSuperAdmin || myBranchAssignments.length > 0) &&
              (isAdmin || isSuperAdmin || canViewFinancials)
            }
          />
        </div>

        {/* --- Tabs with Horizontal Scroll for Mobile --- */}
        <Tabs defaultValue="overview" className="space-y-6">
          <div className="overflow-x-auto no-scrollbar">
            <TabsList className="inline-flex min-w-full md:min-w-0 h-12 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-1">
              <TabsTrigger
                value="overview"
                className="flex-1 md:flex-none md:px-8 font-bold whitespace-nowrap"
              >
                <LayoutGrid className="mr-2 h-4 w-4" /> Overview
              </TabsTrigger>
              <TabsTrigger
                value="history"
                className="flex-1 md:flex-none md:px-8 font-bold whitespace-nowrap"
              >
                <History className="mr-2 h-4 w-4" /> History
              </TabsTrigger>
              <TabsTrigger
                value="forecast"
                className="flex-1 md:flex-none md:px-8 font-bold whitespace-nowrap"
              >
                <TrendingUp className="mr-2 h-4 w-4" /> Forecast
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="overview" className="mt-0 outline-none">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
              {/* Product Table typically needs its own internal overflow-x-auto */}
              <ProductTable
                products={paginatedProducts}
                onEdit={handleEdit}
                onDelete={handleDelete}
                isLoading={productsLoading}
                showBranch={branches.length > 0}
                searchQuery={productSearchQuery}
                onSearchQueryChange={setProductSearchQuery}
                statusFilter={productStatusFilter}
                onStatusFilterChange={setProductStatusFilter}
                categoryTab={productCategoryTab}
                onCategoryTabChange={setProductCategoryTab}
                categoryCounts={categoryCounts}
                totalSellableStockValue={filteredSellableStockValue}
              />

              {/* --- Responsive Pagination Controls --- */}
              <div className="flex flex-col gap-4 px-4 py-4 md:flex-row md:items-center md:justify-between md:px-6 bg-slate-50/50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center justify-between md:justify-start md:gap-6 w-full md:w-auto">
                  <div className="text-xs md:text-sm text-slate-500 font-medium">
                    <span className="hidden md:inline">Showing </span>
                    <span className="text-[#000B26] dark:text-white font-bold">
                      {indexOfFirstItem + 1}-
                      {Math.min(indexOfLastItem, filteredProducts.length)}
                    </span>
                    <span className="text-slate-400 mx-1">/</span>
                    <span className="text-[#000B26] dark:text-white font-bold">
                      {filteredProducts.length}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      Rows:
                    </span>
                    <Select
                      value={itemsPerPage.toString()}
                      onValueChange={(v) => {
                        setItemsPerPage(parseInt(v));
                        setCurrentPage(1);
                      }}
                    >
                      <SelectTrigger className="h-8 w-[65px] font-bold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[10, 20, 50].map((size) => (
                          <SelectItem key={size} value={size.toString()}>
                            {size}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center justify-center gap-1 w-full md:w-auto">
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>

                  {/* Show reduced page numbers on mobile */}
                  <div className="flex items-center gap-1 mx-2">
                    <span className="text-xs font-bold md:hidden">
                      Page {currentPage} of {totalPages}
                    </span>
                    <div className="hidden md:flex gap-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                        (num) => (
                          <Button
                            key={num}
                            size="sm"
                            className={`h-9 w-9 font-bold ${currentPage === num ? "bg-[#FF9E3D] text-[#000B26]" : "bg-transparent text-slate-600"}`}
                            onClick={() => setCurrentPage(num)}
                          >
                            {num}
                          </Button>
                        ),
                      )}
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                    disabled={currentPage === totalPages || totalPages === 0}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Table content containers for other tabs */}
          <TabsContent value="history">
            <div className="overflow-x-auto bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-2 md:p-6 shadow-sm">
              <StockHistoryTable limit={1000} />
            </div>
          </TabsContent>
          <TabsContent value="forecast">
            <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-2 md:p-6 shadow-sm">
              <StockForecastChart />
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* --- Dialogs & Overlays --- */}
      <ProductDialog
        product={editingProduct}
        open={productDialogOpen}
        onOpenChange={(open) => {
          setProductDialogOpen(open);
          if (!open) setEditingProduct(null);
        }}
        allProducts={filteredProducts}
      />
      <UnitsDialog open={unitsDialogOpen} onOpenChange={setUnitsDialogOpen} />
      <BranchesDialog
        open={branchesDialogOpen}
        onOpenChange={setBranchesDialogOpen}
      />
      <UsersManagementDialog
        open={usersDialogOpen}
        onOpenChange={setUsersDialogOpen}
      />
      <PaymentMethodsDialog
        open={paymentMethodsOpen}
        onOpenChange={setPaymentMethodsOpen}
      />

      <AlertDialog
        open={!!deleteProductId}
        onOpenChange={() => setDeleteProductId(null)}
      >
        <AlertDialogContent className="w-[90vw] max-w-lg rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete product?</AlertDialogTitle>
            <AlertDialogDescription>
              This action will permanently remove the record from the database.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-row">
            <AlertDialogCancel className="w-full sm:w-auto">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="w-full sm:w-auto bg-red-600"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
