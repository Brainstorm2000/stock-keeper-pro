import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  ShoppingCart,
  Search,
  Trash2,
  Pause,
  CreditCard,
  Banknote,
  Smartphone,
  Building,
  Clock,
  Loader2,
  X,
  UserPlus,
  Split,
  AlertTriangle,
  LayoutGrid,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ModuleAccessGuard } from "@/components/access/ModuleAccessGuard";
import { useProducts, type Product } from "@/hooks/useProducts";
import { useBranches, useDefaultBranchId } from "@/hooks/useBranches";
import { useOrganization } from "@/hooks/useOrganization";
import { useCustomers, type Customer } from "@/hooks/useCustomers";
import { useAuth } from "@/lib/auth";
import {
  useCreateSale,
  useSaleWithItems,
  useHeldOrders,
  useCreateHeldOrder,
  useDeleteHeldOrder,
  type SaleItem,
  type PaymentMethod,
  type Sale,
  type PaymentDetail,
} from "@/hooks/useSales";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/currency";
import { CartItemRow } from "@/components/pos/CartItemRow";
import { ReceiptDialog } from "@/components/pos/ReceiptDialog";
import { CustomersDialog } from "@/components/customers/CustomersDialog";
import {
  SplitPaymentDialog,
  type PaymentSplit,
} from "@/components/pos/SplitPaymentDialog";

interface CartItem extends SaleItem {
  product_name: string;
  max_quantity?: number;
  item_type: "product" | "service";
}

export default function POS() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [discountPercent, setDiscountPercent] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [taxRate, setTaxRate] = useState(0);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [checkoutDialogOpen, setCheckoutDialogOpen] = useState(false);
  const [heldOrdersDialogOpen, setHeldOrdersDialogOpen] = useState(false);
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);
  const [splitPaymentDialogOpen, setSplitPaymentDialogOpen] = useState(false);
  const [lastSaleId, setLastSaleId] = useState<string | null>(null);
  const [selectedBranchId, setSelectedBranchId] = useState<string>("");
  const [useSplitPayment, setUseSplitPayment] = useState(false);
  const [paymentSplits, setPaymentSplits] = useState<PaymentSplit[]>([]);
  const [paymentType, setPaymentType] = useState<"full" | "partial" | "credit">(
    "full",
  );
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [dueDate, setDueDate] = useState("");
  const [saleDate, setSaleDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [activeTab, setActiveTab] = useState("products");

  const {
    user,
    loading: authLoading,
    isAdmin,
    hasCompletedOnboarding,
  } = useAuth();
  const { data: products = [], isLoading: productsLoading } = useProducts();
  const { data: branches = [] } = useBranches();
  const defaultBranchId = useDefaultBranchId();
  const { data: organization } = useOrganization();
  const { data: customers = [] } = useCustomers();
  const { data: heldOrders = [] } = useHeldOrders();
  const { data: lastSale } = useSaleWithItems(lastSaleId);
  const createSale = useCreateSale();
  const createHeldOrder = useCreateHeldOrder();
  const deleteHeldOrder = useDeleteHeldOrder();
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    if (!selectedBranchId && defaultBranchId) {
      setSelectedBranchId(defaultBranchId);
    }
  }, [defaultBranchId, selectedBranchId]);

  const productBranchById = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const p of products) map.set(p.id, p.branch_id ?? null);
    return map;
  }, [products]);

  const resolveTransactionBranch = ():
    | { ok: true; branchId?: string }
    | { ok: false; message: string } => {
    if (branches.length === 0) return { ok: true };
    const branchIds = new Set<string>();
    for (const item of cart) {
      const b = productBranchById.get(item.product_id);
      if (b) branchIds.add(b);
    }
    const ids = Array.from(branchIds);
    const inferred = ids.length === 1 ? ids[0] : undefined;
    const branchId = selectedBranchId || inferred;
    if (!branchId)
      return {
        ok: false,
        message: "Please select a branch for this transaction.",
      };
    if (ids.length > 1)
      return {
        ok: false,
        message: "Cart contains items from multiple branches.",
      };
    if (ids.length === 1 && branchId !== ids[0])
      return { ok: false, message: "Cart items belong to a different branch." };
    return { ok: true, branchId };
  };

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    } else if (!authLoading && user && hasCompletedOnboarding === false) {
      navigate("/onboarding");
    }
  }, [user, authLoading, hasCompletedOnboarding, navigate]);

  const availableProducts = useMemo(() => {
    return products.filter((p) => {
      const isSellable = p.category === "sellable";
      const matchesSearch =
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesBranch =
        !selectedBranchId || p.branch_id === selectedBranchId || !p.branch_id;
      const hasStock = p.item_type === "service" || Number(p.current_stock) > 0;
      return isSellable && matchesSearch && matchesBranch && hasStock;
    });
  }, [products, searchQuery, selectedBranchId]);

  const subtotal = cart.reduce((sum, item) => sum + item.total_price, 0);
  const discountValue =
    discountPercent > 0 ? (subtotal * discountPercent) / 100 : discountAmount;
  const taxAmount = ((subtotal - discountValue) * taxRate) / 100;
  const total = subtotal - discountValue + taxAmount;

  const addToCart = (product: Product) => {
    const existingIndex = cart.findIndex(
      (item) => item.product_id === product.id,
    );
    const productType = (product as any).item_type || "product";
    const maxQty =
      productType === "service" ? Infinity : Number(product.current_stock);

    if (existingIndex > -1) {
      const newCart = [...cart];
      newCart[existingIndex].quantity += 1;
      newCart[existingIndex].total_price =
        newCart[existingIndex].quantity * newCart[existingIndex].unit_price -
        newCart[existingIndex].discount_amount;
      setCart(newCart);
    } else {
      const sellingPrice = Number((product as any).selling_price) || 0;
      const costPrice = Number((product as any).cost_price) || 0;
      setCart([
        ...cart,
        {
          product_id: product.id,
          product_name: product.name,
          quantity: 1,
          unit_price: sellingPrice,
          cost_price: costPrice,
          discount_amount: 0,
          total_price: sellingPrice,
          max_quantity: maxQty,
          item_type: productType,
        },
      ]);
    }
  };

  const updateQuantity = (index: number, newQty: number) => {
    const newCart = [...cart];
    if (newQty <= 0) {
      newCart.splice(index, 1);
    } else {
      newCart[index].quantity = newQty;
      newCart[index].total_price =
        newQty * newCart[index].unit_price - newCart[index].discount_amount;
    }
    setCart(newCart);
  };

  const updatePrice = (index: number, newPrice: number) => {
    const newCart = [...cart];
    newCart[index].unit_price = newPrice;
    newCart[index].total_price =
      newCart[index].quantity * newPrice - newCart[index].discount_amount;
    setCart(newCart);
  };

  const removeFromCart = (index: number) =>
    setCart(cart.filter((_, i) => i !== index));

  const clearCart = () => {
    setCart([]);
    setDiscountPercent(0);
    setDiscountAmount(0);
    setTaxRate(0);
    setSelectedCustomerId("");
    setCustomerName("");
    setCustomerPhone("");
    setNotes("");
    setUseSplitPayment(false);
    setPaymentSplits([]);
    setPaymentType("full");
    setAmountPaid(0);
    setDueDate("");
  };

  const handleCustomerSelect = (customerId: string) => {
    setSelectedCustomerId(customerId);
    if (customerId && customerId !== "none") {
      const customer = customers.find((c) => c.id === customerId);
      if (customer) {
        setCustomerName(customer.name);
        setCustomerPhone(customer.phone || "");
      }
    } else {
      setCustomerName("");
      setCustomerPhone("");
    }
  };

  const handleHoldOrder = async () => {
    if (cart.length === 0)
      return toast({ title: "Cart is empty", variant: "destructive" });
    if (!organization?.id)
      return toast({ title: "Organization not found", variant: "destructive" });
    const branchResult = resolveTransactionBranch();
    if (branchResult.ok === false)
      return toast({ title: branchResult.message, variant: "destructive" });

    await createHeldOrder.mutateAsync({
      organization_id: organization.id,
      branch_id: branchResult.branchId,
      customer_name: customerName || undefined,
      items: cart,
      notes: notes || undefined,
    });
    clearCart();
  };

  const handleLoadHeldOrder = async (order: any) => {
    setCart(order.items || []);
    setCustomerName(order.customer_name || "");
    setNotes(order.notes || "");
    await deleteHeldOrder.mutateAsync(order.id);
    setHeldOrdersDialogOpen(false);
  };

  const handleCheckout = async () => {
    if (!organization?.id) return;
    const branchResult = resolveTransactionBranch();
    if (branchResult.ok === false)
      return toast({ title: branchResult.message, variant: "destructive" });

    const primaryPaymentMethod =
      useSplitPayment && paymentSplits.length > 0
        ? paymentSplits[0].method
        : paymentMethod;
    const paymentDetails =
      useSplitPayment && paymentSplits.length > 0 ? paymentSplits : undefined;
    const computedAmountPaid =
      paymentType === "full"
        ? total
        : paymentType === "credit"
          ? 0
          : amountPaid;
    const computedBalance = total - computedAmountPaid;

    const result = await createSale.mutateAsync({
      organization_id: organization.id,
      branch_id: branchResult.branchId,
      customer_id:
        selectedCustomerId && selectedCustomerId !== "none"
          ? selectedCustomerId
          : undefined,
      customer_name: customerName || undefined,
      customer_phone: customerPhone || undefined,
      sale_date: saleDate || undefined,
      subtotal,
      discount_amount: discountValue,
      discount_percent: discountPercent,
      tax_amount: taxAmount,
      total_amount: total,
      amount_paid: computedAmountPaid,
      balance_due: Math.max(0, computedBalance),
      payment_status:
        computedBalance <= 0
          ? "paid"
          : computedAmountPaid > 0
            ? "partial"
            : "outstanding",
      due_date: dueDate || undefined,
      payment_method: primaryPaymentMethod,
      payment_details: paymentDetails,
      notes: notes || undefined,
      items: cart.map(
        ({ max_quantity, item_type, product_name, ...item }) => item,
      ),
    });

    setLastSaleId(result.id);
    setCheckoutDialogOpen(false);
    setSplitPaymentDialogOpen(false);
    setReceiptDialogOpen(true);
    clearCart();
  };

  const handleNewSale = () => {
    setReceiptDialogOpen(false);
    setLastSaleId(null);
  };

  const paymentMethods: {
    value: PaymentMethod;
    label: string;
    icon: React.ReactNode;
  }[] = [
    { value: "cash", label: "Cash", icon: <Banknote className="h-4 w-4" /> },
    { value: "card", label: "Card", icon: <CreditCard className="h-4 w-4" /> },
    {
      value: "mobile_money",
      label: "Mobile",
      icon: <Smartphone className="h-4 w-4" />,
    },
    {
      value: "bank_transfer",
      label: "Transfer",
      icon: <Building className="h-4 w-4" />,
    },
    { value: "credit", label: "Credit", icon: <Clock className="h-4 w-4" /> },
  ];

  if (authLoading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );

  return (
    <DashboardLayout>
      <ModuleAccessGuard module="pos" minLevel="create">
        <div className="flex flex-col h-[calc(100vh-8rem)]">
          {/* Top Bar */}
          <div className="flex flex-col sm:flex-row gap-3 mb-4 shrink-0">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-11"
              />
            </div>
          </div>

          {/* Desktop/Mobile Layout Handling */}
          <div className="hidden lg:flex flex-1 gap-4 overflow-hidden">
            <div className="flex-1 overflow-hidden flex flex-col">
              <ScrollArea className="flex-1">
                <ProductGrid
                  products={availableProducts}
                  loading={productsLoading}
                  onAdd={addToCart}
                />
              </ScrollArea>
            </div>
            <div className="w-96 shrink-0">
              <CartPanel
                cart={cart}
                onUpdateQty={updateQuantity}
                onUpdatePrice={updatePrice}
                onRemove={removeFromCart}
                onClear={clearCart}
                onHold={handleHoldOrder}
                onCheckout={() => setCheckoutDialogOpen(true)}
                heldCount={heldOrders.length}
                onViewHeld={() => setHeldOrdersDialogOpen(true)}
                subtotal={subtotal}
                total={total}
                discountPercent={discountPercent}
                setDiscountPercent={setDiscountPercent}
                taxRate={taxRate}
                setTaxRate={setTaxRate}
                isHolding={createHeldOrder.isPending}
                isCheckingOut={createSale.isPending}
              />
            </div>
          </div>

          <div className="lg:hidden flex-1 overflow-hidden">
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="h-full flex flex-col"
            >
              <TabsList className="grid w-full grid-cols-2 mb-4 h-12">
                <TabsTrigger value="products">Products</TabsTrigger>
                <TabsTrigger value="cart" className="relative">
                  Cart{" "}
                  {cart.length > 0 && (
                    <Badge className="ml-2 bg-[#FF9E3D]">{cart.length}</Badge>
                  )}
                </TabsTrigger>
              </TabsList>
              <TabsContent
                value="products"
                className="flex-1 overflow-hidden m-0"
              >
                <ScrollArea className="h-full">
                  <ProductGrid
                    products={availableProducts}
                    loading={productsLoading}
                    onAdd={addToCart}
                  />
                </ScrollArea>
              </TabsContent>
              <TabsContent value="cart" className="flex-1 overflow-hidden m-0">
                <CartPanel
                  cart={cart}
                  onUpdateQty={updateQuantity}
                  onUpdatePrice={updatePrice}
                  onRemove={removeFromCart}
                  onClear={clearCart}
                  onHold={handleHoldOrder}
                  onCheckout={() => setCheckoutDialogOpen(true)}
                  heldCount={heldOrders.length}
                  onViewHeld={() => setHeldOrdersDialogOpen(true)}
                  subtotal={subtotal}
                  total={total}
                  discountPercent={discountPercent}
                  setDiscountPercent={setDiscountPercent}
                  taxRate={taxRate}
                  setTaxRate={setTaxRate}
                  isHolding={createHeldOrder.isPending}
                  isCheckingOut={createSale.isPending}
                />
              </TabsContent>
            </Tabs>
          </div>
        </div>

        {/* --- SCROLLABLE CHECKOUT DIALOG --- */}
        <Dialog open={checkoutDialogOpen} onOpenChange={setCheckoutDialogOpen}>
          <DialogContent className="sm:max-w-md w-[95vw] p-0 overflow-hidden flex flex-col max-h-[90vh] bg-white dark:bg-[#020817] border-slate-200 dark:border-slate-800">
            <DialogHeader className="p-6 pb-2">
              <DialogTitle className="text-[#000B26] dark:text-slate-100">
                Complete Sale
              </DialogTitle>
            </DialogHeader>

            <ScrollArea className="flex-1 px-6 py-2">
              <div className="space-y-6 pb-6">
                {/* Summary Box - Remains high contrast in both modes */}
                <div className="bg-[#000B26] dark:bg-[#000B26] p-5 rounded-2xl flex justify-between items-center shadow-lg border border-white/5">
                  <span className="text-sm font-medium text-slate-400">
                    Total to Pay
                  </span>
                  <span className="text-2xl font-black text-[#FF9E3D]">
                    {formatCurrency(total)}
                  </span>
                </div>

                {/* Basic Info */}
                <div className="grid grid-cols-1 gap-4">
                  <div className="space-y-2">
                    <Label className="text-[10px] uppercase font-black tracking-widest text-slate-500 dark:text-slate-400">
                      Sale Date
                    </Label>
                    <Input
                      type="date"
                      value={saleDate}
                      onChange={(e) => setSaleDate(e.target.value)}
                      className="h-11 bg-transparent border-slate-200 dark:border-slate-800 focus:ring-[#FF9E3D]"
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-[10px] uppercase font-black tracking-widest text-slate-500 dark:text-slate-400">
                        Customer
                      </Label>
                      <CustomersDialog />
                    </div>
                    <Select
                      value={selectedCustomerId || "none"}
                      onValueChange={handleCustomerSelect}
                    >
                      <SelectTrigger className="h-11 bg-transparent border-slate-200 dark:border-slate-800">
                        <SelectValue placeholder="Select customer" />
                      </SelectTrigger>
                      <SelectContent className="dark:bg-[#020817] dark:border-slate-800">
                        <SelectItem value="none">Walk-in Customer</SelectItem>
                        {customers.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Split Payment Toggle */}
                <div className="flex items-center justify-between p-4 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30">
                  <div className="space-y-0.5">
                    <Label
                      htmlFor="split-mode"
                      className="text-sm font-bold text-[#000B26] dark:text-slate-200"
                    >
                      Split Payment
                    </Label>
                    <p className="text-[10px] text-slate-500 dark:text-slate-400">
                      Combine multiple payment methods
                    </p>
                  </div>
                  <Checkbox
                    id="split-mode"
                    checked={useSplitPayment}
                    onCheckedChange={(checked) => {
                      setUseSplitPayment(checked === true);
                      if (checked === true) setSplitPaymentDialogOpen(true);
                    }}
                    className="h-6 w-6 border-slate-300 dark:border-slate-700 data-[state=checked]:bg-[#FF9E3D] data-[state=checked]:border-[#FF9E3D]"
                  />
                </div>

                {/* Standard Payment Methods */}
                {!useSplitPayment && (
                  <div className="space-y-3">
                    <Label className="text-[10px] uppercase font-black tracking-widest text-slate-500 dark:text-slate-400">
                      Payment Method
                    </Label>
                    <div className="grid grid-cols-3 gap-2">
                      {paymentMethods.map((m) => (
                        <button
                          key={m.value}
                          type="button"
                          onClick={() => setPaymentMethod(m.value)}
                          className={cn(
                            "flex flex-col items-center justify-center p-3 rounded-xl border-2 transition-all gap-1.5",
                            paymentMethod === m.value
                              ? "border-[#FF9E3D] bg-amber-50/50 dark:bg-[#FF9E3D]/10 text-[#000B26] dark:text-[#FF9E3D]"
                              : "border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-400 dark:text-slate-500 hover:border-slate-200 dark:hover:border-slate-700",
                          )}
                        >
                          {m.icon}
                          <span className="text-[10px] font-bold uppercase">
                            {m.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Notes */}
                <div className="space-y-2">
                  <Label className="text-[10px] uppercase font-black tracking-widest text-slate-500 dark:text-slate-400">
                    Internal Notes
                  </Label>
                  <Textarea
                    placeholder="Add specific details..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="min-h-[80px] bg-slate-50/50 dark:bg-slate-900/30 border-slate-200 dark:border-slate-800"
                  />
                </div>
              </div>
            </ScrollArea>

            <DialogFooter className="p-6 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-[#020817] gap-3 flex-col sm:flex-row">
              <Button
                variant="outline"
                onClick={() => setCheckoutDialogOpen(false)}
                className="flex-1 h-12 font-bold dark:border-slate-800 dark:hover:bg-slate-900"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCheckout}
                disabled={createSale.isPending}
                className="flex-1 bg-[#FF9E3D] hover:bg-[#e88d30] text-[#000B26] font-black h-12 shadow-lg shadow-amber-500/20"
              >
                {createSale.isPending ? (
                  <Loader2 className="animate-spin mr-2" />
                ) : (
                  <CreditCard className="mr-2 h-4 w-4" />
                )}
                PROCESS SALE
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Existing Dialogs */}
        <ReceiptDialog
          open={receiptDialogOpen}
          onOpenChange={setReceiptDialogOpen}
          sale={lastSale || null}
          organizationName={organization?.name}
          organizationAddress={organization?.address}
          showSuccessMessage={true}
          onNewSale={handleNewSale}
        />
        <SplitPaymentDialog
          open={splitPaymentDialogOpen}
          onOpenChange={setSplitPaymentDialogOpen}
          totalAmount={total}
          payments={paymentSplits}
          onPaymentsChange={setPaymentSplits}
          onConfirm={handleCheckout}
          isLoading={createSale.isPending}
        />
      </ModuleAccessGuard>
    </DashboardLayout>
  );
}

function ProductGrid({
  products,
  loading,
  onAdd,
}: {
  products: any[];
  loading: boolean;
  onAdd: (p: any) => void;
}) {
  if (loading)
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="animate-spin text-muted-foreground" />
      </div>
    );
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 pb-20 lg:pb-0">
      {products.map((p) => {
        const price = Number((p as any).selling_price) || 0;
        return (
          <Card
            key={p.id}
            className="cursor-pointer hover:shadow-md transition-all active:scale-95 overflow-hidden"
            onClick={() => onAdd(p)}
          >
            <CardContent className="p-3">
              <div className="flex flex-col gap-1">
                <span className="font-medium text-xs sm:text-sm line-clamp-2 h-8">
                  {p.name}
                </span>
                <span className="text-base sm:text-lg font-bold text-[#FF9E3D]">
                  {formatCurrency(price)}
                </span>
                <div className="flex items-center justify-between mt-1">
                  <Badge variant="outline" className="text-[9px] px-1 h-4">
                    PRD
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">
                    Qty: {Number(p.current_stock)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

function CartPanel({
  cart,
  onUpdateQty,
  onUpdatePrice,
  onRemove,
  onClear,
  onHold,
  onCheckout,
  heldCount,
  onViewHeld,
  subtotal,
  total,
  discountPercent,
  setDiscountPercent,
  taxRate,
  setTaxRate,
  isHolding,
  isCheckingOut,
}: any) {
  return (
    <Card className="flex flex-col h-full border-none lg:border">
      <CardHeader className="pb-2 p-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" /> Cart
          </CardTitle>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={onViewHeld}
              className="h-8"
            >
              Held ({heldCount})
            </Button>
            {cart.length > 0 && (
              <Button variant="ghost" size="sm" onClick={onClear}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col p-4 pt-0 overflow-hidden">
        <ScrollArea className="flex-1 pr-2">
          {cart.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground text-sm">
              Empty
            </div>
          ) : (
            <div className="space-y-1">
              {cart.map((item: any, idx: number) => (
                <CartItemRow
                  key={item.product_id}
                  item={item}
                  index={idx}
                  onQuantityChange={onUpdateQty}
                  onPriceChange={onUpdatePrice}
                  onRemove={onRemove}
                />
              ))}
            </div>
          )}
        </ScrollArea>
        <div className="mt-4 space-y-3 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px] uppercase font-bold">Disc %</Label>
              <Input
                type="number"
                value={discountPercent || ""}
                onChange={(e) => setDiscountPercent(Number(e.target.value))}
                className="h-8"
              />
            </div>
            <div>
              <Label className="text-[10px] uppercase font-bold">Tax %</Label>
              <Input
                type="number"
                value={taxRate || ""}
                onChange={(e) => setTaxRate(Number(e.target.value))}
                className="h-8"
              />
            </div>
          </div>
          <Separator />
          <div className="flex justify-between text-sm font-bold">
            <span>Total</span>
            <span className="text-[#FF9E3D]">{formatCurrency(total)}</span>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 h-11"
              onClick={onHold}
              disabled={cart.length === 0 || isHolding}
            >
              Hold
            </Button>
            <Button
              className="flex-1 bg-[#FF9E3D] hover:bg-[#e88d30] text-[#000B26] font-bold h-11"
              onClick={onCheckout}
              disabled={cart.length === 0 || isCheckingOut}
            >
              Checkout
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
