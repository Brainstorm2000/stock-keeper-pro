import { useState, useMemo, useEffect } from 'react';
import { format } from 'date-fns';
import { Plus, Trash2, Search, Loader2, Upload } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useCreatePurchase, uploadPurchaseReceipt, type PurchaseItemInput, type PurchasePaymentStatus } from '@/hooks/usePurchases';
import { useProducts, type Product } from '@/hooks/useProducts';
import { useBranches, useDefaultBranchId } from '@/hooks/useBranches';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useOrganization } from '@/hooks/useOrganization';
import { useToast } from '@/hooks/use-toast';

interface PurchaseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CartItem extends PurchaseItemInput {
  product: Product;
}

export function PurchaseDialog({ open, onOpenChange }: PurchaseDialogProps) {
  const { data: organization } = useOrganization();
  const { data: products = [] } = useProducts();
  const { data: branches = [] } = useBranches();
  const { data: suppliers = [] } = useSuppliers();
  const createPurchase = useCreatePurchase();
  const defaultBranchId = useDefaultBranchId();
  const { toast } = useToast();

  const [branchId, setBranchId] = useState('');

  useEffect(() => {
    if (open && !branchId && defaultBranchId) {
      setBranchId(defaultBranchId);
    }
  }, [open, defaultBranchId, branchId]);
  const [supplierId, setSupplierId] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [referenceNumber, setReferenceNumber] = useState('');
  const [taxRate, setTaxRate] = useState('');
  const [amountPaid, setAmountPaid] = useState('');
  const [notes, setNotes] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Filter products by selected branch
  const availableProducts = useMemo(() => {
    if (!branchId) return [];
    return products.filter(p => p.branch_id === branchId || !p.branch_id);
  }, [products, branchId]);

  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return availableProducts.slice(0, 10);
    return availableProducts.filter(p =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku?.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [availableProducts, searchQuery]);

  const subtotalAmount = cart.reduce((sum, item) => sum + (item.quantity * item.unit_cost), 0);
  const numericTaxRate = Number(taxRate) || 0;
  const taxAmount = (subtotalAmount * numericTaxRate) / 100;
  const totalAmount = subtotalAmount + taxAmount;

  // Auto-calculate payment status based on amount paid
  const numericAmountPaid = Number(amountPaid) || 0;
  const paymentStatus: PurchasePaymentStatus = 
    numericAmountPaid <= 0 ? 'pending' :
    numericAmountPaid >= totalAmount ? 'paid' : 'partial';

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(value);
  };

  const addToCart = (product: Product) => {
    const existing = cart.find(item => item.product_id === product.id);
    if (existing) {
      setCart(cart.map(item =>
        item.product_id === product.id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setCart([...cart, {
        product_id: product.id,
        product,
        quantity: 1,
        unit_cost: Number(product.cost_price) || 0,
        selling_price: Number(product.selling_price) || 0,
      }]);
    }
    setSearchQuery('');
  };

  const updateCartItem = (productId: string, field: 'quantity' | 'unit_cost' | 'selling_price', value: number | string) => {
    setCart(cart.map(item =>
      item.product_id === productId
        ? { ...item, [field]: value }
        : item
    ));
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.product_id !== productId));
  };

  const handleSubmit = async () => {
    if (!organization?.id || !branchId || !supplierId || cart.length === 0) return;

    let receiptUrl: string | undefined;
    if (receiptFile) {
      try {
        setUploading(true);
        receiptUrl = await uploadPurchaseReceipt(receiptFile, organization.id);
      } catch (e) {
        toast({ title: 'Failed to upload receipt', variant: 'destructive' });
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    await createPurchase.mutateAsync({
      organization_id: organization.id,
      branch_id: branchId,
      supplier_id: supplierId,
      purchase_date: purchaseDate,
      reference_number: referenceNumber || undefined,
      tax_rate: numericTaxRate,
      payment_status: paymentStatus,
      amount_paid: Number(amountPaid) || 0,
      notes: notes || undefined,
      receipt_url: receiptUrl,
      items: cart.map(({ product, ...item }) => item),
    });

    // Reset form
    setBranchId('');
    setSupplierId('');
    setPurchaseDate(format(new Date(), 'yyyy-MM-dd'));
    setReferenceNumber('');
    setTaxRate('');
    setAmountPaid('');
    setNotes('');
    setReceiptFile(null);
    setCart([]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>New Purchase Order</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6 py-4">
          {/* Purchase Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Branch *</Label>
              <Select value={branchId} onValueChange={setBranchId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent>
                  {branches.filter(branch => branch.id).map(branch => (
                    <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Supplier *</Label>
              <Select value={supplierId} onValueChange={setSupplierId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select supplier" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.filter(supplier => supplier.id).map(supplier => (
                    <SelectItem key={supplier.id} value={supplier.id}>{supplier.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Purchase Date</Label>
              <Input
                type="date"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Reference/Invoice Number</Label>
              <Input
                placeholder="e.g., INV-12345"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Tax Rate (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                step="0.01"
                placeholder="0"
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Payment Status</Label>
              <div className="flex items-center h-10 px-3 rounded-md border bg-muted text-muted-foreground capitalize">
                {paymentStatus}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Amount Paid {totalAmount > 0 && `(max: ${formatCurrency(totalAmount)})`}</Label>
              <Input
                type="number"
                min="0"
                max={totalAmount}
                placeholder="0"
                value={amountPaid}
                onChange={(e) => {
                  const value = e.target.value === '' ? '' : Math.min(Number(e.target.value), totalAmount).toString();
                  setAmountPaid(value);
                }}
              />
            </div>
          </div>

          {/* Product Search */}
          {branchId && (
            <div className="space-y-2">
              <Label>Add Products</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search products by name or SKU..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>

              {searchQuery && filteredProducts.length > 0 && (
                <ScrollArea className="h-48 border rounded-md">
                  <div className="p-2 space-y-1">
                    {filteredProducts.map(product => (
                      <button
                        key={product.id}
                        onClick={() => addToCart(product)}
                        className="w-full flex items-center justify-between p-2 rounded-md hover:bg-muted text-left"
                      >
                        <div>
                          <p className="font-medium">{product.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {product.sku && `SKU: ${product.sku} • `}
                            Stock: {Number(product.current_stock).toLocaleString()} {product.units?.abbreviation}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={product.category === 'sellable' ? 'default' : 'secondary'}>
                            {product.category}
                          </Badge>
                          <Plus className="h-4 w-4" />
                        </div>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          )}

          {/* Cart */}
          {cart.length > 0 && (
            <div className="space-y-2">
              <Label>Purchase Items ({cart.length})</Label>
              <div className="border rounded-md overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Product</TableHead>
                      <TableHead className="w-[100px]">Quantity</TableHead>
                      <TableHead className="w-[120px]">Cost Price</TableHead>
                      <TableHead className="w-[120px]">Sell Price</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cart.map(item => (
                      <TableRow key={item.product_id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{item.product.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {item.product.units?.abbreviation || item.product.units?.name}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateCartItem(item.product_id, 'quantity', e.target.value === '' ? '' : Number(e.target.value))}
                            onBlur={(e) => { if (!e.target.value || Number(e.target.value) < 1) updateCartItem(item.product_id, 'quantity', 1); }}
                            className="w-20"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            step="any"
                            value={item.unit_cost}
                            onChange={(e) => updateCartItem(item.product_id, 'unit_cost', e.target.value === '' ? 0 : Number(e.target.value))}
                            className="w-24"
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min="0"
                            step="any"
                            value={item.selling_price}
                            onChange={(e) => updateCartItem(item.product_id, 'selling_price', e.target.value === '' ? 0 : Number(e.target.value))}
                            className="w-24"
                          />
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(item.quantity * item.unit_cost)}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeFromCart(item.product_id)}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes</Label>
            <Textarea
              placeholder="Additional notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          {/* Receipt upload */}
          <div className="space-y-2">
            <Label>Receipt (JPG, JPEG, PNG)</Label>
            <Input
              type="file"
              accept=".jpg,.jpeg,.png"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const allowed = ['image/jpeg', 'image/jpg', 'image/png'];
                if (!allowed.includes(file.type)) {
                  toast({ title: 'Invalid file type', description: 'Only JPG, JPEG, and PNG allowed', variant: 'destructive' });
                  e.target.value = '';
                  return;
                }
                if (file.size > 5 * 1024 * 1024) {
                  toast({ title: 'File too large', description: 'Maximum file size is 5MB', variant: 'destructive' });
                  e.target.value = '';
                  return;
                }
                setReceiptFile(file);
              }}
            />
            {receiptFile && (
              <p className="text-xs text-muted-foreground">Selected: {receiptFile.name}</p>
            )}
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="flex-shrink-0 border-t pt-4">
          <div className="flex items-center justify-between w-full">
            <div className="space-y-1">
              <div className="text-sm text-muted-foreground">
                Subtotal: {formatCurrency(subtotalAmount)}
                {numericTaxRate > 0 && ` + Tax (${numericTaxRate}%): ${formatCurrency(taxAmount)}`}
              </div>
              <div className="text-lg font-bold">
                Total: {formatCurrency(totalAmount)}
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!branchId || !supplierId || cart.length === 0 || createPurchase.isPending || uploading}
              >
                {createPurchase.isPending || uploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {uploading ? 'Uploading...' : 'Creating...'}
                  </>
                ) : (
                  'Create Purchase'
                )}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
