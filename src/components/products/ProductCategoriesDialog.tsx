import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Pencil, Plus, Tags, Trash2 } from 'lucide-react';
import { useCreateProductCategory, useDeleteProductCategory, useProductCategories, useUpdateProductCategory } from '@/hooks/useProductCategories';

interface ProductCategoriesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ProductCategoriesDialog({ open, onOpenChange }: ProductCategoriesDialogProps) {
  const [name, setName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const { data: categories = [], isLoading } = useProductCategories();
  const createCategory = useCreateProductCategory();
  const updateCategory = useUpdateProductCategory();
  const deleteCategory = useDeleteProductCategory();

  const resetForm = () => {
    setName('');
    setEditingId(null);
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) return;

    if (editingId) {
      await updateCategory.mutateAsync({ id: editingId, name: trimmedName });
    } else {
      await createCategory.mutateAsync(trimmedName);
    }

    resetForm();
  };

  const handleEdit = (categoryId: string, currentName: string) => {
    setEditingId(categoryId);
    setName(currentName);
  };

  const handleDelete = async (categoryId: string) => {
    if (window.confirm('Delete this product category?')) {
      await deleteCategory.mutateAsync(categoryId);
      if (editingId === categoryId) resetForm();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(value) => {
      onOpenChange(value);
      if (!value) resetForm();
    }}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tags className="h-5 w-5" /> Product Categories
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleCreate} className="space-y-3">
          <Label htmlFor="product-category-name">{editingId ? 'Edit category' : 'New category'}</Label>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              id="product-category-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Toiletries"
              maxLength={100}
            />
            <div className="flex gap-2 sm:flex-row">
              <Button
                type="submit"
                disabled={!name.trim() || createCategory.isPending || updateCategory.isPending}
                aria-label={editingId ? 'Update category' : 'Create category'}
                className="flex-1 sm:flex-none"
              >
                {createCategory.isPending || updateCategory.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
              </Button>
              {editingId && (
                <Button type="button" variant="outline" onClick={resetForm} className="flex-1 sm:flex-none">
                  Cancel
                </Button>
              )}
            </div>
          </div>
        </form>

        <div className="space-y-2 min-h-0 flex-1">
          <h3 className="text-sm font-medium">Categories</h3>
          {isLoading ? (
            <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : categories.length === 0 ? (
            <p className="py-4 text-sm text-muted-foreground">No categories created.</p>
          ) : (
            <ul className="max-h-64 space-y-1 overflow-y-auto pr-1">
              {categories.map((category) => (
                <li key={category.id} className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
                  <span className="truncate">{category.name}</span>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleEdit(category.id, category.name)}
                      aria-label={`Edit ${category.name}`}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="text-destructive"
                      onClick={() => handleDelete(category.id)}
                      aria-label={`Delete ${category.name}`}
                      disabled={deleteCategory.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
