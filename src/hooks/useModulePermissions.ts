import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from '@/hooks/use-toast';

export type AppModule = 'pos' | 'sales' | 'purchases' | 'expenses' | 'production';
export type ModuleAccessLevel = 'none' | 'view' | 'create' | 'full';
export type AppRole = 'admin' | 'user' | 'super_admin';

export interface RoleModulePermission {
  id: string;
  organization_id: string;
  role: AppRole;
  module: AppModule;
  access_level: ModuleAccessLevel;
}

export interface UserModulePermission {
  id: string;
  user_id: string;
  module: AppModule;
  access_level: ModuleAccessLevel;
}

export const ALL_MODULES: AppModule[] = ['pos', 'sales', 'purchases', 'expenses', 'production'];

export const MODULE_LABELS: Record<AppModule, string> = {
  pos: 'Point of Sale',
  sales: 'Sales',
  purchases: 'Purchases',
  expenses: 'Expenses',
  production: 'Production',
};

export const ACCESS_LEVEL_LABELS: Record<ModuleAccessLevel, string> = {
  none: 'No Access',
  view: 'View Only',
  create: 'View & Create',
  full: 'Full Access',
};

// Hook to get the current user's module access
export function useMyModuleAccess() {
  const { user, isSuperAdmin } = useAuth();

  return useQuery({
    queryKey: ['my-module-access', user?.id],
    queryFn: async () => {
      if (!user) return null;

      // Super admins have full access to everything
      if (isSuperAdmin) {
      const access: Record<AppModule, ModuleAccessLevel> = {
          pos: 'full',
          sales: 'full',
          purchases: 'full',
          expenses: 'full',
          production: 'full',
        };
        return access;
      }

      // Fetch user-specific overrides
      const { data: userPerms, error: userError } = await supabase
        .from('user_module_permissions')
        .select('module, access_level')
        .eq('user_id', user.id);

      if (userError) throw userError;

      // Fetch role-based permissions
      const { data: rolePerms, error: roleError } = await supabase
        .from('role_module_permissions')
        .select('module, access_level');

      if (roleError) throw roleError;

      // Build access map - user overrides take precedence
      const access: Record<AppModule, ModuleAccessLevel> = {
        pos: 'none',
        sales: 'none',
        purchases: 'none',
        expenses: 'none',
        production: 'none',
      };

      // Apply role-based permissions first
      rolePerms?.forEach((perm) => {
        access[perm.module as AppModule] = perm.access_level as ModuleAccessLevel;
      });

      // Apply user-specific overrides
      userPerms?.forEach((perm) => {
        access[perm.module as AppModule] = perm.access_level as ModuleAccessLevel;
      });

      return access;
    },
    enabled: !!user,
  });
}

// Helper to check if user has at least a certain access level
export function hasAccess(
  moduleAccess: Record<AppModule, ModuleAccessLevel> | null | undefined,
  module: AppModule,
  minLevel: ModuleAccessLevel
): boolean {
  if (!moduleAccess) return false;
  
  const userLevel = moduleAccess[module];
  const levels: ModuleAccessLevel[] = ['none', 'view', 'create', 'full'];
  
  return levels.indexOf(userLevel) >= levels.indexOf(minLevel);
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
      accessLevel 
    }: { 
      role: AppRole; 
      module: AppModule; 
      accessLevel: ModuleAccessLevel 
    }) => {
      if (!organizationId) throw new Error('No organization');

      const { error } = await supabase
        .from('role_module_permissions')
        .upsert({
          organization_id: organizationId,
          role,
          module,
          access_level: accessLevel,
        }, {
          onConflict: 'organization_id,role,module',
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['role-module-permissions'] });
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
      accessLevel 
    }: { 
      userId: string; 
      module: AppModule; 
      accessLevel: ModuleAccessLevel | null; // null = remove override
    }) => {
      if (accessLevel === null) {
        // Remove the override
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
            access_level: accessLevel,
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
