import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { useBranches, useUserBranchAssignments, useAssignUserToBranch, useRemoveUserFromBranch } from '@/hooks/useBranches';
import { Loader2, MapPin } from 'lucide-react';
import type { UserWithRole } from '@/hooks/useUsers';

interface UserBranchAssignmentDialogProps {
  user: UserWithRole | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserBranchAssignmentDialog({ user, open, onOpenChange }: UserBranchAssignmentDialogProps) {
  const { data: branches = [], isLoading: branchesLoading } = useBranches();
  const { data: assignments = [], isLoading: assignmentsLoading } = useUserBranchAssignments(user?.user_id);
  const assignUser = useAssignUserToBranch();
  const removeUser = useRemoveUserFromBranch();
  const [processingBranches, setProcessingBranches] = useState<Set<string>>(new Set());

  const isLoading = branchesLoading || assignmentsLoading;
  const assignedBranchIds = new Set(assignments.map((a) => a.branch_id));

  const handleToggleBranch = async (branchId: string, isAssigned: boolean) => {
    if (!user) return;

    setProcessingBranches((prev) => new Set(prev).add(branchId));

    try {
      if (isAssigned) {
        await removeUser.mutateAsync({ userId: user.user_id, branchId });
      } else {
        await assignUser.mutateAsync({ userId: user.user_id, branchId });
      }
    } finally {
      setProcessingBranches((prev) => {
        const next = new Set(prev);
        next.delete(branchId);
        return next;
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Assign Branches to {user?.full_name || user?.email || 'User'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : branches.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No branches available</p>
              <p className="text-sm">Create branches first to assign them to users</p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Select the branches this admin can access and manage:
              </p>
              {branches.map((branch) => {
                const isAssigned = assignedBranchIds.has(branch.id);
                const isProcessing = processingBranches.has(branch.id);

                return (
                  <div
                    key={branch.id}
                    className="flex items-center space-x-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                  >
                    <Checkbox
                      id={`branch-${branch.id}`}
                      checked={isAssigned}
                      disabled={isProcessing}
                      onCheckedChange={() => handleToggleBranch(branch.id, isAssigned)}
                    />
                    <div className="flex-1 min-w-0">
                      <Label
                        htmlFor={`branch-${branch.id}`}
                        className="font-medium cursor-pointer"
                      >
                        {branch.name}
                      </Label>
                      {branch.address && (
                        <p className="text-sm text-muted-foreground truncate">
                          {branch.address}
                        </p>
                      )}
                    </div>
                    {isProcessing && (
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
