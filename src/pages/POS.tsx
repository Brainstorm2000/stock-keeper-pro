import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, Search, Trash2, Pause, CreditCard, Banknote, Smartphone, Building, Clock, Loader2, X, UserPlus, Split, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ModuleAccessGuard } from '@/components/access/ModuleAccessGuard';
import { useProducts, type Product } from '@/hooks/useProducts';
import { useBranches } from '@/hooks/useBranches';
import { useOrganization } from '@/hooks/useOrganization';
import { useCustomers, type Customer } from '@/hooks/useCustomers';
import { useAuth } from '@/lib/auth';
import { useCreateSale, useSaleWithItems, useHeldOrders, useCreateHeldOrder, useDeleteHeldOrder, type SaleItem, type PaymentMethod, type Sale, type PaymentDetail } from '@/hooks/useSales';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
 import { formatCurrency } from '@/lib/currency';
import { CartItemRow } from '@/components/pos/CartItemRow';
import { ReceiptDialog } from '@/components/pos/ReceiptDialog';
import { CustomersDialog } from '@/components/customers/CustomersDialog';
import { SplitPaymentDialog, type PaymentSplit } from '@/components/pos/SplitPaymentDialog';

interface CartItem extends SaleItem {
  product_name: string;
  max_quantity?: number;
  item_type: 'product' | 'service';
}

export default function POS() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [discountPercent, setDiscountPercent] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [taxRate, setTaxRate] = useState(0);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [checkoutDialogOpen, setCheckoutDialogOpen] = useState(false);
  const [heldOrdersDialogOpen, setHeldOrdersDialogOpen] = useState(false);
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);
  const [splitPaymentDialogOpen, setSplitPaymentDialogOpen] = useState(false);
  const [lastSaleId, setLastSaleId] = useState<string | null>(null);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [useSplitPayment, setUseSplitPayment] = useState(false);
  const [paymentSplits, setPaymentSplits] = useState<PaymentSplit[]>([]);

  const { user, loading: authLoading, isAdmin, hasCompletedOnboarding } = useAuth();
  const { data: products = [], isLoading: productsLoading } = useProducts();
  const { data: branches = [] } = useBranches();
  const { data: organization } = useOrganization();
  const { data: customers = [] } = useCustomers();
  const { data: heldOrders = [] } = useHeldOrders();
  const { data: lastSale } = useSaleWithItems(lastSaleId);
  const createSale = useCreateSale();
  const createHeldOrder = useCreateHeldOrder();
  const deleteHeldOrder = useDeleteHeldOrder();
  const { toast } = useToast();
  const navigate = useNavigate();

  const productBranchById = useMemo(() => {
    const map = new Map<string, string | null>();
    for (const p of products) map.set(p.id, p.branch_id ?? null);
    return map;
  }, [products]);

  const resolveTransactionBranch = (): { ok: true; branchId?: string } | { ok: false; message: string } => {
    // If the org has no branches configured, keep the transaction unassigned.
    if (branches.length === 0) return { ok: true };

    const branchIds = new Set<string>();
    for (const item of cart) {
      const b = productBranchById.get(item.product_id);
      if (b) branchIds.add(b);
    }

    const ids = Array.from(branchIds);
    const inferred = ids.length === 1 ? ids[0] : undefined;
    const branchId = selectedBranchId || inferred;

    // If all items are "global" (no product branch_id), we still need an explicit branch.
    if (!branchId) {
      return { ok: false, message: 'Please select a branch for this transaction.' };
    }

    // Prevent mixing multiple branch-specific items in one transaction.
    if (ids.length > 1) {
      return {
        ok: false,
        message: 'Cart contains items from multiple branches. Please clear the cart or select one branch and only sell items from that branch.',
      };
    }

    // If cart items belong to a specific branch, ensure the chosen branch matches it.
    if (ids.length === 1 && branchId !== ids[0]) {
      return {
        ok: false,
        message: 'This cart contains items from a different branch. Switch branch (or clear the cart) to continue.',
      };
    }

    return { ok: true, branchId };
  };

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    } else if (!authLoading && user && hasCompletedOnboarding === false) {
      navigate('/onboarding');
    }
  }, [user, authLoading, hasCompletedOnboarding, navigate]);

  // Filter products for sale (only sellable items with selling price)
  const availableProducts = useMemo(() => {
    return products.filter(p => {
      const isSellable = p.category === 'sellable';
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesBranch = !selectedBranchId || p.branch_id === selectedBranchId || !p.branch_id;
      const hasStock = p.item_type === 'service' || Number(p.current_stock) > 0;
      return isSellable && matchesSearch && matchesBranch && hasStock;
    });
  }, [products, searchQuery, selectedBranchId]);

  // Calculate totals
  const subtotal = cart.reduce((sum, item) => sum + item.total_price, 0);
  const discountValue = discountPercent > 0 ? (subtotal * discountPercent) / 100 : discountAmount;
  const taxAmount = ((subtotal - discountValue) * taxRate) / 100;
  const total = subtotal - discountValue + taxAmount;

  // Check for stock warnings in cart
  const hasStockWarning = useMemo(() => {
    return cart.some(item => 
      item.item_type === 'product' && 
      item.max_quantity !== undefined && 
      item.quantity > item.max_quantity
    );
  }, [cart]);

  const addToCart = (product: Product) => {
    const existingIndex = cart.findIndex(item => item.product_id === product.id);
    const productType = (product as any).item_type || 'product';
    const maxQty = productType === 'service' ? Infinity : Number(product.current_stock);
    
    if (existingIndex > -1) {
      const newCart = [...cart];
      // Allow exceeding stock with warning - don't block
      newCart[existingIndex].quantity += 1;
      newCart[existingIndex].total_price = 
        (newCart[existingIndex].quantity * newCart[existingIndex].unit_price) - newCart[existingIndex].discount_amount;
      setCart(newCart);
      
      // Show warning if exceeding stock
      if (productType === 'product' && newCart[existingIndex].quantity > maxQty) {
        toast({ 
          title: 'Stock warning', 
          description: `${product.name} exceeds available stock (${maxQty} available)`,
          variant: 'destructive' 
        });
      }
    } else {
      const sellingPrice = Number((product as any).selling_price) || 0;
      const costPrice = Number((product as any).cost_price) || 0;
      
      setCart([...cart, {
        product_id: product.id,
        product_name: product.name,
        quantity: 1,
        unit_price: sellingPrice,
        cost_price: costPrice,
        discount_amount: 0,
        total_price: sellingPrice,
        max_quantity: maxQty,
        item_type: productType,
      }]);
    }
  };

  const updateQuantity = (index: number, newQty: number) => {
    const newCart = [...cart];
    
    if (newQty <= 0) {
      newCart.splice(index, 1);
    } else {
      newCart[index].quantity = newQty;
      newCart[index].total_price = (newQty * newCart[index].unit_price) - newCart[index].discount_amount;
      
      if (newCart[index].item_type === 'product' && 
          newCart[index].max_quantity !== undefined && 
          newQty > newCart[index].max_quantity) {
        toast({ 
          title: 'Stock warning', 
          description: `${newCart[index].product_name} exceeds available stock (${newCart[index].max_quantity} available)`,
          variant: 'destructive' 
        });
      }
    }
    
    setCart(newCart);
  };

  const updatePrice = (index: number, newPrice: number) => {
    const newCart = [...cart];
    newCart[index].unit_price = newPrice;
    newCart[index].total_price = (newCart[index].quantity * newPrice) - newCart[index].discount_amount;
    setCart(newCart);
  };

  const removeFromCart = (index: number) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  const clearCart = () => {
    setCart([]);
    setDiscountPercent(0);
    setDiscountAmount(0);
    setTaxRate(0);
    setSelectedCustomerId('');
    setCustomerName('');
    setCustomerPhone('');
    setNotes('');
    setUseSplitPayment(false);
    setPaymentSplits([]);
  };

  const handleCustomerSelect = (customerId: string) => {
    setSelectedCustomerId(customerId);
    if (customerId && customerId !== 'none') {
      const customer = customers.find(c => c.id === customerId);
      if (customer) {
        setCustomerName(customer.name);
        setCustomerPhone(customer.phone || '');
      }
    } else {
      setCustomerName('');
      setCustomerPhone('');
    }
  };

  const handleHoldOrder = async () => {
    if (cart.length === 0) {
      toast({ title: 'Cart is empty', variant: 'destructive' });
      return;
    }

    if (!organization?.id) {
      toast({ title: 'Organization not found', variant: 'destructive' });
      return;
    }

    const branchResult = resolveTransactionBranch();
    if (branchResult.ok === false) {
      toast({ title: branchResult.message, variant: 'destructive' });
      return;
    }

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
    setCustomerName(order.customer_name || '');
    setNotes(order.notes || '');
    await deleteHeldOrder.mutateAsync(order.id);
    setHeldOrdersDialogOpen(false);
  };

  const handleCheckout = async () => {
    if (!organization?.id) {
      toast({ title: 'Organization not found', variant: 'destructive' });
      return;
    }

    const branchResult = resolveTransactionBranch();
    if (branchResult.ok === false) {
      toast({ title: branchResult.message, variant: 'destructive' });
      return;
    }

    // Determine payment method and details
    const primaryPaymentMethod = useSplitPayment && paymentSplits.length > 0 
      ? paymentSplits[0].method 
      : paymentMethod;
    
    const paymentDetails = useSplitPayment && paymentSplits.length > 0 
      ? paymentSplits 
      : undefined;

    const result = await createSale.mutateAsync({
      organization_id: organization.id,
      branch_id: branchResult.branchId,
      customer_id: selectedCustomerId && selectedCustomerId !== 'none' ? selectedCustomerId : undefined,
      customer_name: customerName || undefined,
      customer_phone: customerPhone || undefined,
      subtotal,
      discount_amount: discountValue,
      discount_percent: discountPercent,
      tax_amount: taxAmount,
      total_amount: total,
      payment_method: primaryPaymentMethod,
      payment_details: paymentDetails,
      notes: notes || undefined,
      items: cart.map(({ max_quantity, item_type, product_name, ...item }) => item),
    });

    setLastSaleId(result.id);
    setCheckoutDialogOpen(false);
    setSplitPaymentDialogOpen(false);
    setReceiptDialogOpen(true);
    clearCart();
    
    // Play loud notification sound on sale completion
    playSaleCompletedSound();
  };

  const playSaleCompletedSound = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Create a loud, attention-grabbing sound sequence
      const playTone = (frequency: number, startTime: number, duration: number, volume: number = 0.8) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = frequency;
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(volume, startTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
        
        oscillator.start(startTime);
        oscillator.stop(startTime + duration);
      };
      
      const now = audioContext.currentTime;
      
      // Play a cheerful "cha-ching" style sequence - loud and unmistakable
      playTone(880, now, 0.15, 0.9);           // A5
      playTone(1108.73, now + 0.1, 0.15, 0.9); // C#6
      playTone(1318.51, now + 0.2, 0.3, 1.0);  // E6 (louder, longer)
      playTone(1760, now + 0.35, 0.4, 1.0);    // A6 (highest, loudest)
      
    } catch (error) {
      console.log('Audio playback not supported');
    }
  };

  const handleSplitPaymentConfirm = () => {
    handleCheckout();
  };

  const handleNewSale = () => {
    setReceiptDialogOpen(false);
    setLastSaleId(null);
  };

  const paymentMethods: { value: PaymentMethod; label: string; icon: React.ReactNode }[] = [
    { value: 'cash', label: 'Cash', icon: <Banknote className="h-4 w-4" /> },
    { value: 'card', label: 'Card', icon: <CreditCard className="h-4 w-4" /> },
    { value: 'mobile_money', label: 'Mobile Money', icon: <Smartphone className="h-4 w-4" /> },
    { value: 'bank_transfer', label: 'Bank Transfer', icon: <Building className="h-4 w-4" /> },
    { value: 'credit', label: 'Credit', icon: <Clock className="h-4 w-4" /> },
  ];

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <DashboardLayout>
      <ModuleAccessGuard module="pos" minLevel="create">
      <div className="h-[calc(100vh-8rem)] flex flex-col lg:flex-row gap-4">
        {/* Products Section */}
        <div className="flex-1 flex flex-col">
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search products/services..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            {branches.length > 0 && (
              <Select value={selectedBranchId || "all"} onValueChange={(val) => setSelectedBranchId(val === "all" ? "" : val)}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="All Branches" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Branches</SelectItem>
                  {branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <ScrollArea className="flex-1">
            {productsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {availableProducts.map((product) => {
                  const productType = (product as any).item_type || 'product';
                  const sellingPrice = Number((product as any).selling_price) || 0;
                  
                  return (
                    <Card
                      key={product.id}
                      className="cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => addToCart(product)}
                    >
                      <CardContent className="p-3">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-start justify-between gap-1">
                            <span className="font-medium text-sm line-clamp-2">{product.name}</span>
                            <Badge variant={productType === 'service' ? 'secondary' : 'outline'} className="text-xs shrink-0">
                              {productType === 'service' ? 'SVC' : 'PRD'}
                            </Badge>
                          </div>
                          <span className="text-lg font-bold text-primary">
                             {formatCurrency(sellingPrice)}
                          </span>
                          {productType === 'product' && (
                            <span className="text-xs text-muted-foreground">
                              Stock: {Number(product.current_stock)}
                            </span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Cart Section */}
        <Card className="lg:w-96 flex flex-col">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5" />
                Cart ({cart.length})
              </CardTitle>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setHeldOrdersDialogOpen(true)}
                  disabled={heldOrders.length === 0}
                >
                  <Pause className="h-4 w-4 mr-1" />
                  Held ({heldOrders.length})
                </Button>
                {cart.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={clearCart}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          
          <CardContent className="flex-1 flex flex-col p-4 pt-0">
            <ScrollArea className="flex-1 -mx-4 px-4">
              {cart.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Cart is empty
                </div>
              ) : (
                <div className="space-y-2">
                  {cart.map((item, index) => (
                    <CartItemRow
                      key={item.product_id}
                      item={item}
                      index={index}
                      onQuantityChange={updateQuantity}
                      onPriceChange={updatePrice}
                      onRemove={removeFromCart}
                    />
                  ))}
                </div>
              )}
            </ScrollArea>

            <div className="mt-4 space-y-3">
              <Separator />
              
              {/* Discount */}
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label className="text-xs">Discount %</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={discountPercent}
                    onChange={(e) => {
                      setDiscountPercent(Number(e.target.value));
                      setDiscountAmount(0);
                    }}
                    className="h-8"
                  />
                </div>
                <div className="flex-1">
                  <Label className="text-xs">Discount Amt</Label>
                  <Input
                    type="number"
                    min="0"
                    value={discountAmount}
                    onChange={(e) => {
                      setDiscountAmount(Number(e.target.value));
                      setDiscountPercent(0);
                    }}
                    className="h-8"
                  />
                </div>
              </div>

              {/* Tax Rate */}
              <div className="flex gap-2">
                <div className="flex-1">
                  <Label className="text-xs">Tax Rate (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={taxRate}
                    onChange={(e) => setTaxRate(Number(e.target.value))}
                    className="h-8"
                  />
                </div>
              </div>

              {/* Totals */}
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                   <span>{formatCurrency(subtotal)}</span>
                </div>
                {discountValue > 0 && (
                  <div className="flex justify-between text-destructive">
                    <span>Discount</span>
                     <span>-{formatCurrency(discountValue)}</span>
                  </div>
                )}
                {taxAmount > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Tax ({taxRate}%)</span>
                     <span>+{formatCurrency(taxAmount)}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                   <span>{formatCurrency(total)}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  disabled={cart.length === 0 || createHeldOrder.isPending}
                  onClick={handleHoldOrder}
                >
                  <Pause className="h-4 w-4 mr-1" />
                  Hold
                </Button>
                <Button
                  className="flex-1"
                  disabled={cart.length === 0}
                  onClick={() => setCheckoutDialogOpen(true)}
                >
                  Checkout
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Checkout Dialog */}
      <Dialog open={checkoutDialogOpen} onOpenChange={setCheckoutDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Complete Sale</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Customer Selection */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Customer</Label>
                <CustomersDialog />
              </div>
              <Select 
                value={selectedCustomerId || 'none'} 
                onValueChange={handleCustomerSelect}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select customer (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Walk-in Customer</SelectItem>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name} {customer.phone && `(${customer.phone})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Customer Name</Label>
                <Input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Optional"
                />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="Optional"
                />
              </div>
            </div>

            {/* Split Payment Toggle */}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="split-payment"
                checked={useSplitPayment}
                onCheckedChange={(checked) => {
                  setUseSplitPayment(checked === true);
                  if (checked) {
                    setPaymentSplits([{ method: 'cash', amount: total }]);
                  } else {
                    setPaymentSplits([]);
                  }
                }}
              />
              <Label htmlFor="split-payment" className="text-sm font-normal cursor-pointer">
                Split payment across multiple methods
              </Label>
            </div>

            {!useSplitPayment && (
              <div className="space-y-2">
                <Label>Payment Method</Label>
                <div className="grid grid-cols-3 gap-2">
                  {paymentMethods.map((method) => (
                    <Button
                      key={method.value}
                      type="button"
                      variant={paymentMethod === method.value ? 'default' : 'outline'}
                      className="flex flex-col h-auto py-3 gap-1"
                      onClick={() => setPaymentMethod(method.value)}
                    >
                      {method.icon}
                      <span className="text-xs">{method.label}</span>
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {useSplitPayment && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Payment Split</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSplitPaymentDialogOpen(true)}
                  >
                    <Split className="h-4 w-4 mr-1" />
                    Configure Split
                  </Button>
                </div>
                {paymentSplits.length > 0 && (
                  <div className="bg-muted/50 p-3 rounded-lg text-sm space-y-1">
                    {paymentSplits.map((split, index) => (
                      <div key={index} className="flex justify-between">
                        <span className="capitalize">{split.method.replace('_', ' ')}</span>
                         <span>{formatCurrency(split.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes..."
                rows={2}
              />
            </div>

            {/* Stock Warning */}
            {hasStockWarning && (
              <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive text-sm">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>Some items exceed available stock. Proceeding may result in negative inventory.</span>
              </div>
            )}

            <div className="bg-muted p-4 rounded-lg">
              <div className="flex justify-between text-lg font-bold">
                <span>Total Amount</span>
                 <span>{formatCurrency(total)}</span>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCheckoutDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCheckout} disabled={createSale.isPending}>
              {createSale.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                'Complete Sale'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Split Payment Dialog */}
      <SplitPaymentDialog
        open={splitPaymentDialogOpen}
        onOpenChange={setSplitPaymentDialogOpen}
        totalAmount={total}
        payments={paymentSplits}
        onPaymentsChange={setPaymentSplits}
        onConfirm={handleSplitPaymentConfirm}
      />

      {/* Held Orders Dialog */}
      <Dialog open={heldOrdersDialogOpen} onOpenChange={setHeldOrdersDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Held Orders ({heldOrders.length})</DialogTitle>
          </DialogHeader>
          
          <ScrollArea className="max-h-[400px]">
            {heldOrders.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">No held orders</p>
            ) : (
              <div className="space-y-3">
                {heldOrders.map((order) => (
                  <Card
                    key={order.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleLoadHeldOrder(order)}
                  >
                    <CardContent className="p-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">{order.customer_name || 'Walk-in Customer'}</p>
                          <p className="text-sm text-muted-foreground">
                            {(order.items as SaleItem[]).length} items
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(order.created_at).toLocaleString()}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteHeldOrder.mutate(order.id);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Receipt Dialog */}
      <ReceiptDialog
        open={receiptDialogOpen}
        onOpenChange={setReceiptDialogOpen}
        sale={lastSale || null}
        organizationName={organization?.name}
        organizationAddress={organization?.address || undefined}
        organizationEmail={organization?.email || undefined}
        showSuccessMessage={true}
        onNewSale={handleNewSale}
      />
      </ModuleAccessGuard>
    </DashboardLayout>
  );
}
