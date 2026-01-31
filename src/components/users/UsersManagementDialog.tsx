import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useManageableUsers, type UserWithRole } from '@/hooks/useUsers';
import { useBranches, useUserBranchAssignments } from '@/hooks/useBranches';
import { UserBranchAssignmentDialog } from './UserBranchAssignmentDialog';
import { Users, Loader2, Settings, Shield, Eye } from 'lucide-react';

interface UsersManagementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function UserBranchBadges({ userId }: { userId: string }) {
  const { data: assignments = [] } = useUserBranchAssignments(userId);
  const { data: branches = [] } = useBranches();

  const assignedBranches = branches.filter((b) =>
    assignments.some((a) => a.branch_id === b.id)
  );

  if (assignedBranches.length === 0) {
    return (
      <span className="text-sm text-muted-foreground italic">No branches assigned</span>
    );
  }

  return (
    <div className="flex flex-wrap gap-1">
      {assignedBranches.map((branch) => (
        <Badge key={branch.id} variant="secondary" className="text-xs">
          {branch.name}
        </Badge>
      ))}
    </div>
  );
}

function RoleBadge({ role }: { role: 'admin' | 'user' | 'super_admin' }) {
  if (role === 'admin') {
    return (
      <Badge variant="default" className="text-xs gap-1">
        <Shield className="h-3 w-3" />
        Admin
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className="text-xs gap-1">
      <Eye className="h-3 w-3" />
      Viewer
    </Badge>
  );
}

export function UsersManagementDialog({ open, onOpenChange }: UsersManagementDialogProps) {
  const { data: users = [], isLoading } = useManageableUsers();
  const [selectedUser, setSelectedUser] = useState<UserWithRole | null>(null);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);

  const handleManageBranches = (user: UserWithRole) => {
    setSelectedUser(user);
    setAssignDialogOpen(true);
  };

  const handleAssignDialogClose = (open: boolean) => {
    setAssignDialogOpen(open);
    if (!open) {
      setSelectedUser(null);
    }
  };

  // Sort users: admins first, then viewers
  const sortedUsers = [...users].sort((a, b) => {
    if (a.role === 'admin' && b.role !== 'admin') return -1;
    if (a.role !== 'admin' && b.role === 'admin') return 1;
    return (a.full_name || '').localeCompare(b.full_name || '');
  });

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Manage User Branch Access
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Assign branches to users. Admins can manage products in their assigned branches. Viewers can only view products in their assigned branches.
            </p>

            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : sortedUsers.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No users found</p>
                <p className="text-sm">Users with admin or viewer role will appear here</p>
              </div>
            ) : (
              <div className="space-y-3">
                {sortedUsers.map((user) => (
                  <div
                    key={user.id}
                    className="p-4 rounded-lg border bg-card space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium truncate">
                            {user.full_name || 'Unnamed User'}
                          </p>
                          <RoleBadge role={user.role} />
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          {user.email}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleManageBranches(user)}
                      >
                        <Settings className="mr-2 h-4 w-4" />
                        Branches
                      </Button>
                    </div>
                    <div className="pt-1">
                      <UserBranchBadges userId={user.user_id} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <UserBranchAssignmentDialog
        user={selectedUser}
        open={assignDialogOpen}
        onOpenChange={handleAssignDialogClose}
      />
    </>
  );
}
