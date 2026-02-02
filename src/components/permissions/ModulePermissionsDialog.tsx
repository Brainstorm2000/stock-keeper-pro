import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
import { Loader2, RotateCcw } from 'lucide-react';
import {
  ALL_MODULES,
  MODULE_LABELS,
  ACCESS_LEVEL_LABELS,
  AppModule,
  ModuleAccessLevel,
  AppRole,
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

const ACCESS_LEVELS: ModuleAccessLevel[] = ['none', 'view', 'create', 'full'];

export function ModulePermissionsDialog({ open, onOpenChange }: ModulePermissionsDialogProps) {
  const [activeTab, setActiveTab] = useState<'roles' | 'users'>('roles');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
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

  const getPermission = (role: AppRole, module: AppModule): ModuleAccessLevel => {
    const perm = permissions?.find((p) => p.role === role && p.module === module);
    return perm?.access_level || 'none';
  };

  const handleChange = (role: AppRole, module: AppModule, accessLevel: ModuleAccessLevel) => {
    upsertMutation.mutate({ role, module, accessLevel });
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
      
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Module</TableHead>
            {ROLES.map((role) => (
              <TableHead key={role.value}>{role.label}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {ALL_MODULES.map((module) => (
            <TableRow key={module}>
              <TableCell className="font-medium">{MODULE_LABELS[module]}</TableCell>
              {ROLES.map((role) => (
                <TableCell key={role.value}>
                  <Select
                    value={getPermission(role.value, module)}
                    onValueChange={(value) => handleChange(role.value, module, value as ModuleAccessLevel)}
                    disabled={upsertMutation.isPending}
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ACCESS_LEVELS.map((level) => (
                        <SelectItem key={level} value={level}>
                          {ACCESS_LEVEL_LABELS[level]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function UserPermissionsTable() {
  const { data: users, isLoading: usersLoading } = useManageableUsers();
  const { data: permissions, isLoading: permsLoading } = useUserModulePermissions();
  const { data: rolePermissions } = useRoleModulePermissions();
  const upsertMutation = useUpsertUserModulePermission();

  const getUserPermission = (userId: string, module: AppModule): ModuleAccessLevel | 'default' => {
    const perm = permissions?.find((p) => p.user_id === userId && p.module === module);
    return perm?.access_level || 'default';
  };

  const getRoleDefault = (role: AppRole, module: AppModule): ModuleAccessLevel => {
    const perm = rolePermissions?.find((p) => p.role === role && p.module === module);
    return perm?.access_level || 'none';
  };

  const handleChange = (userId: string, module: AppModule, value: string) => {
    if (value === 'default') {
      upsertMutation.mutate({ userId, module, accessLevel: null });
    } else {
      upsertMutation.mutate({ userId, module, accessLevel: value as ModuleAccessLevel });
    }
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
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Override role defaults for specific users. Select "Use Role Default" to remove the override.
      </p>
      
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>User</TableHead>
            <TableHead>Role</TableHead>
            {ALL_MODULES.map((module) => (
              <TableHead key={module}>{MODULE_LABELS[module]}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {users.map((user) => (
            <TableRow key={user.user_id}>
              <TableCell className="font-medium">
                <div>
                  <div>{user.full_name || 'Unnamed'}</div>
                  <div className="text-xs text-muted-foreground">{user.email}</div>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="secondary">
                  {user.role === 'admin' ? 'Admin' : 'Viewer'}
                </Badge>
              </TableCell>
              {ALL_MODULES.map((module) => {
                const currentValue = getUserPermission(user.user_id, module);
                const roleDefault = getRoleDefault(user.role, module);
                const isOverridden = currentValue !== 'default';

                return (
                  <TableCell key={module}>
                    <div className="flex items-center gap-1">
                      <Select
                        value={currentValue}
                        onValueChange={(value) => handleChange(user.user_id, module, value)}
                        disabled={upsertMutation.isPending}
                      >
                        <SelectTrigger className={`w-[130px] ${isOverridden ? 'border-primary' : ''}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="default">
                            Role Default ({ACCESS_LEVEL_LABELS[roleDefault]})
                          </SelectItem>
                          {ACCESS_LEVELS.map((level) => (
                            <SelectItem key={level} value={level}>
                              {ACCESS_LEVEL_LABELS[level]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {isOverridden && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleChange(user.user_id, module, 'default')}
                          title="Reset to role default"
                        >
                          <RotateCcw className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
