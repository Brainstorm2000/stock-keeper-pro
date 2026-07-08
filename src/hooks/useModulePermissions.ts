import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from '@/hooks/use-toast';

export type AppModule = 'pos' | 'sales' | 'purchases' | 'expenses' | 'production' | 'reports' | 'staff' | 'tasks' | 'debts' | 'returns' | 'products' | 'dashboard_financials';
export type CrudPermission = 'view' | 'create' | 'edit' | 'delete';
export type AppRole = 'admin' | 'user' | 'super_admin' | 'super_super_admin';

// Keep legacy type for backward compat in guards
export type ModuleAccessLevel = 'none' | 'view' | 'create' | 'full';

export interface ModuleCrudPermissions {
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

export interface RoleModulePermission {
  id: string;
  organization_id: string;
  role: AppRole;
  module: AppModule;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

export interface UserModulePermission {
  id: string;
  user_id: string;
  module: AppModule;
  can_view: boolean;
  can_create: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

export const ALL_MODULES: AppModule[] = ['pos', 'sales', 'purchases', 'expenses', 'production', 'reports', 'staff', 'tasks', 'debts', 'returns', 'products', 'dashboard_financials'];

export const MODULE_LABELS: Record<AppModule, string> = {
  pos: 'Point of Sale',
  sales: 'Sales',
  purchases: 'Purchases',
  expenses: 'Expenses',
  production: 'Production',
  reports: 'Reports',
  staff: 'Staff Management',
  tasks: 'Action Tracker',
  debts: 'Debts',
  returns: 'Returns',
  products: 'Products',
  dashboard_financials: 'Dashboard Financial Overview',
};

export const CRUD_LABELS: Record<CrudPermission, string> = {
  view: 'View',
  create: 'Create',
  edit: 'Edit',
  delete: 'Delete',
};

// Legacy labels kept for any remaining references
export const ACCESS_LEVEL_LABELS: Record<ModuleAccessLevel, string> = {
  none: 'No Access',
  view: 'View Only',
  create: 'View & Create',
  full: 'Full Access',
};

// Hook to get org-level module enablement
export function useOrgModules() {
  const { organizationId } = useAuth();

  return useQuery({
    queryKey: ['org-modules', organizationId],
    queryFn: async () => {
      if (!organizationId) return null;
      const { data, error } = await supabase
        .from('organization_modules')
        .select('module, is_enabled')
        .eq('organization_id', organizationId);
      if (error) throw error;
      const map: Record<string, boolean> = {};
      (data || []).forEach((row: any) => {
        map[row.module] = row.is_enabled;
      });
      return map;
    },
    enabled: !!organizationId,
  });
}

const FULL_CRUD: ModuleCrudPermissions = { can_view: true, can_create: true, can_edit: true, can_delete: true };
const NO_CRUD: ModuleCrudPermissions = { can_view: false, can_create: false, can_edit: false, can_delete: false };

// Hook to get the current user's module access
export function useMyModuleAccess() {
  const { user, isSuperAdmin } = useAuth();
  const { data: orgModules } = useOrgModules();

  return useQuery({
    queryKey: ['my-module-access', user?.id, orgModules],
    queryFn: async () => {
      if (!user) return null;

      // Super admins have full access to everything
      if (isSuperAdmin) {
        const access: Record<AppModule, ModuleCrudPermissions> = {} as any;
        ALL_MODULES.forEach((mod) => {
          access[mod] = orgModules?.[mod] === false ? { ...NO_CRUD } : { ...FULL_CRUD };
        });
        return access;
      }

      // Fetch user-specific overrides
      const { data: userPerms, error: userError } = await supabase
        .from('user_module_permissions')
        .select('module, can_view, can_create, can_edit, can_delete')
        .eq('user_id', user.id);

      if (userError) throw userError;

      // Fetch role-based permissions
      const { data: rolePerms, error: roleError } = await supabase
        .from('role_module_permissions')
        .select('module, can_view, can_create, can_edit, can_delete');

      if (roleError) throw roleError;

      // Build access map
      const access: Record<AppModule, ModuleCrudPermissions> = {} as any;
      ALL_MODULES.forEach((mod) => {
        access[mod] = { ...NO_CRUD };
      });

      // Apply role-based permissions first
      rolePerms?.forEach((perm) => {
        access[perm.module as AppModule] = {
          can_view: perm.can_view,
          can_create: perm.can_create,
          can_edit: perm.can_edit,
          can_delete: perm.can_delete,
        };
      });

      // Apply user-specific overrides
      userPerms?.forEach((perm) => {
        access[perm.module as AppModule] = {
          can_view: perm.can_view,
          can_create: perm.can_create,
          can_edit: perm.can_edit,
          can_delete: perm.can_delete,
        };
      });

      // Override with org-level module disablement
      if (orgModules) {
        ALL_MODULES.forEach((mod) => {
          if (orgModules[mod] === false) {
            access[mod] = { ...NO_CRUD };
          }
        });
      }

      return access;
    },
    enabled: !!user,
  });
}

// Helper to check if user has a specific CRUD permission
export function hasAccess(
  moduleAccess: Record<AppModule, ModuleCrudPermissions> | null | undefined,
  module: AppModule,
  minLevel: ModuleAccessLevel | CrudPermission
): boolean {
  if (!moduleAccess) return false;
  const perms = moduleAccess[module];
  if (!perms) return false;

  // Support both legacy levels and new CRUD permissions
  switch (minLevel) {
    case 'none': return true;
    case 'view': return perms.can_view;
    case 'create': return perms.can_create;
    case 'edit': return perms.can_edit;
    case 'delete': return perms.can_delete;
    case 'full': return perms.can_view && perms.can_create && perms.can_edit && perms.can_delete;
    default: return false;
  }
}

// Hook to fetch role module permissions for the organization
export function useRoleModulePermissions() {
  const { organizationId } = useAuth();

  return useQuery({
    queryKey: ['role-module-permissions', organizationId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('role_module_permissions')
        .select('*')
        .order('role')
        .order('module');

      if (error) throw error;
      return data as RoleModulePermission[];
    },
    enabled: !!organizationId,
  });
}

// Hook to fetch user module permissions for the organization
export function useUserModulePermissions() {
  return useQuery({
    queryKey: ['user-module-permissions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_module_permissions')
        .select('*')
        .order('user_id')
        .order('module');

      if (error) throw error;
      return data as UserModulePermission[];
    },
  });
}

// Mutation to upsert role module permission
export function useUpsertRoleModulePermission() {
  const queryClient = useQueryClient();
  const { organizationId } = useAuth();

  return useMutation({
    mutationFn: async ({ 
      role, 
      module, 
      permissions 
    }: { 
      role: AppRole; 
      module: AppModule; 
      permissions: ModuleCrudPermissions;
    }) => {
      if (!organizationId) throw new Error('No organization');

      const { error } = await supabase
        .from('role_module_permissions')
        .upsert({
          organization_id: organizationId,
          role,
          module,
          ...permissions,
        }, {
          onConflict: 'organization_id,role,module',
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['role-module-permissions'] });
      queryClient.invalidateQueries({ queryKey: ['my-module-access'] });
      toast({ title: 'Permission updated' });
    },
    onError: (error) => {
      toast({ title: 'Error updating permission', description: error.message, variant: 'destructive' });
    },
  });
}

// Mutation to upsert user module permission
export function useUpsertUserModulePermission() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ 
      userId, 
      module, 
      permissions 
    }: { 
      userId: string; 
      module: AppModule; 
      permissions: ModuleCrudPermissions | null; // null = remove override
    }) => {
      if (permissions === null) {
        const { error } = await supabase
          .from('user_module_permissions')
          .delete()
          .eq('user_id', userId)
          .eq('module', module);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('user_module_permissions')
          .upsert({
            user_id: userId,
            module,
            ...permissions,
          }, {
            onConflict: 'user_id,module',
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-module-permissions'] });
      queryClient.invalidateQueries({ queryKey: ['my-module-access'] });
      toast({ title: 'User permission updated' });
    },
    onError: (error) => {
      toast({ title: 'Error updating permission', description: error.message, variant: 'destructive' });
    },
  });
}
