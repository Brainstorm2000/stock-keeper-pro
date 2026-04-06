import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, RotateCcw } from 'lucide-react';
import {
  ALL_MODULES,
  MODULE_LABELS,
  CRUD_LABELS,
  AppModule,
  AppRole,
  CrudPermission,
  ModuleCrudPermissions,
  useRoleModulePermissions,
  useUserModulePermissions,
  useUpsertRoleModulePermission,
  useUpsertUserModulePermission,
} from '@/hooks/useModulePermissions';
import { useManageableUsers } from '@/hooks/useUsers';

interface ModulePermissionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ROLES: { value: AppRole; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'user', label: 'Viewer' },
];

const CRUD_KEYS: CrudPermission[] = ['view', 'create', 'edit', 'delete'];

export function ModulePermissionsDialog({ open, onOpenChange }: ModulePermissionsDialogProps) {
  const [activeTab, setActiveTab] = useState<'roles' | 'users'>('roles');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Module Permissions</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'roles' | 'users')} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="roles">Role Defaults</TabsTrigger>
            <TabsTrigger value="users">User Overrides</TabsTrigger>
          </TabsList>

          <TabsContent value="roles" className="flex-1 overflow-auto mt-4">
            <RolePermissionsTable />
          </TabsContent>

          <TabsContent value="users" className="flex-1 overflow-auto mt-4">
            <UserPermissionsTable />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function RolePermissionsTable() {
  const { data: permissions, isLoading } = useRoleModulePermissions();
  const upsertMutation = useUpsertRoleModulePermission();

  const getPermissions = (role: AppRole, module: AppModule): ModuleCrudPermissions => {
    const perm = permissions?.find((p) => p.role === role && p.module === module);
    return {
      can_view: perm?.can_view ?? false,
      can_create: perm?.can_create ?? false,
      can_edit: perm?.can_edit ?? false,
      can_delete: perm?.can_delete ?? false,
    };
  };

  const handleToggle = (role: AppRole, module: AppModule, key: CrudPermission, checked: boolean) => {
    const current = getPermissions(role, module);
    const updated = { ...current, [`can_${key}`]: checked };
    // If unchecking view, uncheck all others too
    if (key === 'view' && !checked) {
      updated.can_create = false;
      updated.can_edit = false;
      updated.can_delete = false;
    }
    // If checking create/edit/delete, also ensure view is on
    if (key !== 'view' && checked) {
      updated.can_view = true;
    }
    upsertMutation.mutate({ role, module, permissions: updated });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Set default module access for each role. These apply to all users with that role unless overridden.
      </p>

      {ROLES.map((role) => (
        <div key={role.value} className="space-y-2">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Badge variant="secondary">{role.label}</Badge>
          </h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Module</TableHead>
                {CRUD_KEYS.map((key) => (
                  <TableHead key={key} className="text-center w-20">{CRUD_LABELS[key]}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {ALL_MODULES.map((module) => {
                const perms = getPermissions(role.value, module);
                return (
                  <TableRow key={module}>
                    <TableCell className="font-medium">{MODULE_LABELS[module]}</TableCell>
                    {CRUD_KEYS.map((key) => (
                      <TableCell key={key} className="text-center">
                        <Checkbox
                          checked={perms[`can_${key}`]}
                          onCheckedChange={(checked) => handleToggle(role.value, module, key, !!checked)}
                          disabled={upsertMutation.isPending}
                        />
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ))}
    </div>
  );
}

function UserPermissionsTable() {
  const { data: users, isLoading: usersLoading } = useManageableUsers();
  const { data: permissions, isLoading: permsLoading } = useUserModulePermissions();
  const { data: rolePermissions } = useRoleModulePermissions();
  const upsertMutation = useUpsertUserModulePermission();

  const getUserPermission = (userId: string, module: AppModule): ModuleCrudPermissions | null => {
    const perm = permissions?.find((p) => p.user_id === userId && p.module === module);
    if (!perm) return null; // no override
    return {
      can_view: perm.can_view,
      can_create: perm.can_create,
      can_edit: perm.can_edit,
      can_delete: perm.can_delete,
    };
  };

  const getRoleDefault = (role: AppRole, module: AppModule): ModuleCrudPermissions => {
    const perm = rolePermissions?.find((p) => p.role === role && p.module === module);
    return {
      can_view: perm?.can_view ?? false,
      can_create: perm?.can_create ?? false,
      can_edit: perm?.can_edit ?? false,
      can_delete: perm?.can_delete ?? false,
    };
  };

  const handleToggle = (userId: string, role: AppRole, module: AppModule, key: CrudPermission, checked: boolean) => {
    const current = getUserPermission(userId, module) ?? getRoleDefault(role, module);
    const updated = { ...current, [`can_${key}`]: checked };
    if (key === 'view' && !checked) {
      updated.can_create = false;
      updated.can_edit = false;
      updated.can_delete = false;
    }
    if (key !== 'view' && checked) {
      updated.can_view = true;
    }
    upsertMutation.mutate({ userId, module, permissions: updated });
  };

  const handleReset = (userId: string, module: AppModule) => {
    upsertMutation.mutate({ userId, module, permissions: null });
  };

  if (usersLoading || permsLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!users || users.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No users to configure
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Override role defaults for specific users. Click reset to remove overrides.
      </p>

      {users.map((user) => (
        <div key={user.user_id} className="space-y-2 border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-medium">{user.full_name || 'Unnamed'}</span>
            <span className="text-xs text-muted-foreground">{user.email}</span>
            <Badge variant="secondary">{user.role === 'admin' ? 'Admin' : 'Viewer'}</Badge>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Module</TableHead>
                {CRUD_KEYS.map((key) => (
                  <TableHead key={key} className="text-center w-20">{CRUD_LABELS[key]}</TableHead>
                ))}
                <TableHead className="w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ALL_MODULES.map((module) => {
                const override = getUserPermission(user.user_id, module);
                const roleDefault = getRoleDefault(user.role, module);
                const perms = override ?? roleDefault;
                const isOverridden = override !== null;

                return (
                  <TableRow key={module} className={isOverridden ? 'bg-primary/5' : ''}>
                    <TableCell className="font-medium">
                      {MODULE_LABELS[module]}
                      {isOverridden && <Badge variant="outline" className="ml-2 text-[10px]">Override</Badge>}
                    </TableCell>
                    {CRUD_KEYS.map((key) => (
                      <TableCell key={key} className="text-center">
                        <Checkbox
                          checked={perms[`can_${key}`]}
                          onCheckedChange={(checked) => handleToggle(user.user_id, user.role, module, key, !!checked)}
                          disabled={upsertMutation.isPending}
                        />
                      </TableCell>
                    ))}
                    <TableCell>
                      {isOverridden && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() => handleReset(user.user_id, module)}
                          title="Reset to role default"
                        >
                          <RotateCcw className="h-3 w-3" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ))}
    </div>
  );
}
