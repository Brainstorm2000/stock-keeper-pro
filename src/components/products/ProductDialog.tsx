import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useUnits } from '@/hooks/useUnits';
import { useCreateProduct, useUpdateProduct, type Product, type ProductInput } from '@/hooks/useProducts';
import { Loader2 } from 'lucide-react';

const productSchema = z.object({
  name: z.string().trim().min(1, 'Product name is required').max(200),
  unit_id: z.string().min(1, 'Unit is required'),
  opening_stock: z.coerce.number().min(0, 'Must be 0 or greater'),
  current_stock: z.coerce.number().min(0, 'Must be 0 or greater'),
  low_stock_threshold: z.coerce.number().min(0, 'Must be 0 or greater'),
  out_of_stock_threshold: z.coerce.number().min(0, 'Must be 0 or greater'),
  sku: z.string().max(50).optional(),
  description: z.string().max(500).optional(),
});

type ProductFormData = z.infer<typeof productSchema>;

interface ProductDialogProps {
  product?: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProductDialog({ product, open, onOpenChange }: ProductDialogProps) {
  const { data: units = [] } = useUnits();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();

  const isEditing = !!product;
  const isLoading = createProduct.isPending || updateProduct.isPending;

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: '',
      unit_id: '',
      opening_stock: 0,
      current_stock: 0,
      low_stock_threshold: 10,
      out_of_stock_threshold: 0,
      sku: '',
      description: '',
    },
  });

  useEffect(() => {
    if (product) {
      reset({
        name: product.name,
        unit_id: product.unit_id,
        opening_stock: Number(product.opening_stock),
        current_stock: Number(product.current_stock),
        low_stock_threshold: Number(product.low_stock_threshold),
        out_of_stock_threshold: Number(product.out_of_stock_threshold),
        sku: product.sku || '',
        description: product.description || '',
      });
    } else {
      reset({
        name: '',
        unit_id: '',
        opening_stock: 0,
        current_stock: 0,
        low_stock_threshold: 10,
        out_of_stock_threshold: 0,
        sku: '',
        description: '',
      });
    }
  }, [product, reset]);

  const onSubmit = async (data: ProductFormData) => {
    const productData: ProductInput = {
      name: data.name,
      unit_id: data.unit_id,
      opening_stock: data.opening_stock,
      current_stock: data.current_stock,
      low_stock_threshold: data.low_stock_threshold,
      out_of_stock_threshold: data.out_of_stock_threshold,
      sku: data.sku || undefined,
      description: data.description || undefined,
    };

    if (isEditing && product) {
      await updateProduct.mutateAsync({ id: product.id, ...productData });
    } else {
      await createProduct.mutateAsync(productData);
    }

    onOpenChange(false);
  };

  const selectedUnitId = watch('unit_id');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Product' : 'Add New Product'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="name">Product Name *</Label>
              <Input
                id="name"
                {...register('name')}
                placeholder="e.g., Coca-Cola 500ml"
              />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="unit_id">Unit of Measurement *</Label>
              <Select value={selectedUnitId} onValueChange={(value) => setValue('unit_id', value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select unit" />
                </SelectTrigger>
                <SelectContent>
                  {units.map((unit) => (
                    <SelectItem key={unit.id} value={unit.id}>
                      {unit.name} {unit.abbreviation && `(${unit.abbreviation})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.unit_id && <p className="text-sm text-destructive">{errors.unit_id.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="sku">SKU (Optional)</Label>
              <Input
                id="sku"
                {...register('sku')}
                placeholder="e.g., SKU-001"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="opening_stock">Opening Stock</Label>
              <Input
                id="opening_stock"
                type="number"
                min="0"
                step="0.01"
                {...register('opening_stock')}
              />
              {errors.opening_stock && <p className="text-sm text-destructive">{errors.opening_stock.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="current_stock">Current Stock</Label>
              <Input
                id="current_stock"
                type="number"
                min="0"
                step="0.01"
                {...register('current_stock')}
              />
              {errors.current_stock && <p className="text-sm text-destructive">{errors.current_stock.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="low_stock_threshold">Low Stock Threshold</Label>
              <Input
                id="low_stock_threshold"
                type="number"
                min="0"
                step="0.01"
                {...register('low_stock_threshold')}
              />
              {errors.low_stock_threshold && <p className="text-sm text-destructive">{errors.low_stock_threshold.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="out_of_stock_threshold">Out of Stock Threshold</Label>
              <Input
                id="out_of_stock_threshold"
                type="number"
                min="0"
                step="0.01"
                {...register('out_of_stock_threshold')}
              />
              {errors.out_of_stock_threshold && <p className="text-sm text-destructive">{errors.out_of_stock_threshold.message}</p>}
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                {...register('description')}
                placeholder="Product description..."
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {isEditing ? 'Updating...' : 'Creating...'}
                </>
              ) : (
                isEditing ? 'Update Product' : 'Create Product'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
