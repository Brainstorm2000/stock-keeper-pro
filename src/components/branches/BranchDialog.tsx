import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCreateBranch, useUpdateBranch, type Branch, type BranchInput } from '@/hooks/useBranches';
import { Loader2 } from 'lucide-react';

const branchSchema = z.object({
  name: z.string().trim().min(1, 'Branch name is required').max(200),
  address: z.string().max(500).optional(),
});

type BranchFormData = z.infer<typeof branchSchema>;

interface BranchDialogProps {
  branch?: Branch | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BranchDialog({ branch, open, onOpenChange }: BranchDialogProps) {
  const createBranch = useCreateBranch();
  const updateBranch = useUpdateBranch();

  const isEditing = !!branch;
  const isLoading = createBranch.isPending || updateBranch.isPending;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<BranchFormData>({
    resolver: zodResolver(branchSchema),
    defaultValues: {
      name: '',
      address: '',
    },
  });

  useEffect(() => {
    if (branch) {
      reset({
        name: branch.name,
        address: branch.address || '',
      });
    } else {
      reset({
        name: '',
        address: '',
      });
    }
  }, [branch, reset]);

  const onSubmit = async (data: BranchFormData) => {
    const branchData: BranchInput = {
      name: data.name,
      address: data.address || undefined,
    };

    if (isEditing && branch) {
      await updateBranch.mutateAsync({ id: branch.id, ...branchData });
    } else {
      await createBranch.mutateAsync(branchData);
    }

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Branch' : 'Add New Branch'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Branch Name *</Label>
            <Input
              id="name"
              {...register('name')}
              placeholder="e.g., Main Store"
            />
            {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">Address (Optional)</Label>
            <Textarea
              id="address"
              {...register('address')}
              placeholder="Branch address..."
              rows={2}
            />
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
                isEditing ? 'Update Branch' : 'Create Branch'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
