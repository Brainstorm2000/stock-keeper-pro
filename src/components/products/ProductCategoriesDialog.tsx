import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Plus, Tags } from 'lucide-react';
import { useCreateProductCategory, useProductCategories } from '@/hooks/useProductCategories';

interface ProductCategoriesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProductCategoriesDialog({ open, onOpenChange }: ProductCategoriesDialogProps) {
  const [name, setName] = useState('');
  const { data: categories = [], isLoading } = useProductCategories();
  const createCategory = useCreateProductCategory();

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;
    await createCategory.mutateAsync(trimmedName);
    setName('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tags className="h-5 w-5" /> Product Categories
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleCreate} className="space-y-3">
          <Label htmlFor="product-category-name">New category</Label>
          <div className="flex gap-2">
            <Input
              id="product-category-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Toiletries"
              maxLength={100}
            />
            <Button type="submit" disabled={!name.trim() || createCategory.isPending} aria-label="Create category">
              {createCategory.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </Button>
          </div>
        </form>
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Categories</h3>
          {isLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : categories.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">No categories created.</p>
          ) : (
            <ul className="max-h-64 space-y-1 overflow-y-auto">
              {categories.map((category) => (
                <li key={category.id} className="rounded-md border px-3 py-2 text-sm">{category.name}</li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
