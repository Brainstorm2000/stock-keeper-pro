import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useBranches, useDeleteBranch, type Branch } from '@/hooks/useBranches';
import { BranchDialog } from './BranchDialog';
import { Plus, Pencil, Trash2, MapPin, Loader2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

interface BranchesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function BranchesDialog({ open, onOpenChange }: BranchesDialogProps) {
  const { data: branches = [], isLoading } = useBranches();
  const deleteBranch = useDeleteBranch();
  const [branchDialogOpen, setBranchDialogOpen] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [deleteBranchId, setDeleteBranchId] = useState<string | null>(null);

  const handleEdit = (branch: Branch) => {
    setEditingBranch(branch);
    setBranchDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    setDeleteBranchId(id);
  };

  const confirmDelete = async () => {
    if (deleteBranchId) {
      await deleteBranch.mutateAsync(deleteBranchId);
      setDeleteBranchId(null);
    }
  };

  const handleBranchDialogClose = (open: boolean) => {
    setBranchDialogOpen(open);
    if (!open) {
      setEditingBranch(null);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Manage Branches
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <Button onClick={() => setBranchDialogOpen(true)} className="w-full">
              <Plus className="mr-2 h-4 w-4" />
              Add New Branch
            </Button>

            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : branches.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No branches yet</p>
                <p className="text-sm">Create your first branch to get started</p>
              </div>
            ) : (
              <div className="space-y-2">
                {branches.map((branch) => (
                  <div
                    key={branch.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card"
                  >
                    <div>
                      <p className="font-medium">{branch.name}</p>
                      {branch.address && (
                        <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                          {branch.address}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(branch)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(branch.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <BranchDialog
        branch={editingBranch}
        open={branchDialogOpen}
        onOpenChange={handleBranchDialogClose}
      />

      <AlertDialog open={!!deleteBranchId} onOpenChange={() => setDeleteBranchId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Branch</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this branch? Products assigned to this branch will be unassigned.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
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
