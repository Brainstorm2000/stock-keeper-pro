import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart, Search, Trash2, Pause, CreditCard, Banknote, Smartphone, Building, Clock, Loader2, X } from 'lucide-react';
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
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { useProducts, type Product } from '@/hooks/useProducts';
import { useBranches } from '@/hooks/useBranches';
import { useOrganization } from '@/hooks/useOrganization';
import { useAuth } from '@/lib/auth';
import { useCreateSale, useSaleWithItems, useHeldOrders, useCreateHeldOrder, useDeleteHeldOrder, type SaleItem, type PaymentMethod, type Sale } from '@/hooks/useSales';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { CartItemRow } from '@/components/pos/CartItemRow';
import { ReceiptDialog } from '@/components/pos/ReceiptDialog';

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
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [checkoutDialogOpen, setCheckoutDialogOpen] = useState(false);
  const [heldOrdersDialogOpen, setHeldOrdersDialogOpen] = useState(false);
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);
  const [lastSaleId, setLastSaleId] = useState<string | null>(null);
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');

  const { user, loading: authLoading, isAdmin, hasCompletedOnboarding } = useAuth();
  const { data: products = [], isLoading: productsLoading } = useProducts();
  const { data: branches = [] } = useBranches();
  const { data: organization } = useOrganization();
  const { data: heldOrders = [] } = useHeldOrders();
  const { data: lastSale } = useSaleWithItems(lastSaleId);
  const createSale = useCreateSale();
  const createHeldOrder = useCreateHeldOrder();
  const deleteHeldOrder = useDeleteHeldOrder();
  const { toast } = useToast();
  const navigate = useNavigate();

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
  const total = subtotal - discountValue;

  const addToCart = (product: Product) => {
    const existingIndex = cart.findIndex(item => item.product_id === product.id);
    const productType = (product as any).item_type || 'product';
    const maxQty = productType === 'service' ? Infinity : Number(product.current_stock);
    
    if (existingIndex > -1) {
      const newCart = [...cart];
      const currentQty = newCart[existingIndex].quantity;
      if (currentQty < maxQty) {
        newCart[existingIndex].quantity += 1;
        newCart[existingIndex].total_price = 
          (newCart[existingIndex].quantity * newCart[existingIndex].unit_price) - newCart[existingIndex].discount_amount;
        setCart(newCart);
      } else {
        toast({ title: 'Not enough stock', variant: 'destructive' });
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
    } else if (newCart[index].item_type === 'service' || newQty <= (newCart[index].max_quantity || Infinity)) {
      newCart[index].quantity = newQty;
      newCart[index].total_price = (newQty * newCart[index].unit_price) - newCart[index].discount_amount;
    } else {
      toast({ title: 'Not enough stock', variant: 'destructive' });
      return;
    }
    
    setCart(newCart);
  };

  const removeFromCart = (index: number) => {
    setCart(cart.filter((_, i) => i !== index));
  };

  const clearCart = () => {
    setCart([]);
    setDiscountPercent(0);
    setDiscountAmount(0);
    setCustomerName('');
    setCustomerPhone('');
    setNotes('');
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

    await createHeldOrder.mutateAsync({
      organization_id: organization.id,
      branch_id: selectedBranchId || undefined,
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

    const result = await createSale.mutateAsync({
      organization_id: organization.id,
      branch_id: selectedBranchId || undefined,
      customer_name: customerName || undefined,
      customer_phone: customerPhone || undefined,
      subtotal,
      discount_amount: discountValue,
      discount_percent: discountPercent,
      tax_amount: 0,
      total_amount: total,
      payment_method: paymentMethod,
      notes: notes || undefined,
      items: cart.map(({ max_quantity, item_type, product_name, ...item }) => item),
    });

    setLastSaleId(result.id);
    setCheckoutDialogOpen(false);
    setReceiptDialogOpen(true);
    clearCart();
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
                            {sellingPrice.toLocaleString()}
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

              {/* Totals */}
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{subtotal.toLocaleString()}</span>
                </div>
                {discountValue > 0 && (
                  <div className="flex justify-between text-destructive">
                    <span>Discount</span>
                    <span>-{discountValue.toLocaleString()}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span>{total.toLocaleString()}</span>
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

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes..."
                rows={2}
              />
            </div>

            <div className="bg-muted p-4 rounded-lg">
              <div className="flex justify-between text-lg font-bold">
                <span>Total Amount</span>
                <span>{total.toLocaleString()}</span>
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
    </DashboardLayout>
  );
}
