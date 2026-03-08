import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface UserWithRole {
  id: string;
  user_id: string;
  email: string | null;
  full_name: string | null;
  role: 'admin' | 'user' | 'super_admin' | 'super_super_admin';
  created_at: string;
}

export function useUsersWithRoles() {
  return useQuery({
    queryKey: ['users-with-roles'],
    queryFn: async () => {
      // Get profiles with their roles
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*');

      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('*');

      if (rolesError) throw rolesError;

      // Combine profiles with roles
      const usersWithRoles: UserWithRole[] = profiles.map((profile) => {
        const userRole = roles.find((r) => r.user_id === profile.user_id);
        return {
          id: profile.id,
          user_id: profile.user_id,
          email: profile.email,
          full_name: profile.full_name,
          role: userRole?.role || 'user',
          created_at: profile.created_at,
        };
      });

      return usersWithRoles;
    },
  });
}

export function useAdminUsers() {
  return useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      // Get admin user_ids from user_roles
      const { data: adminRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id')
        .eq('role', 'admin');

      if (rolesError) throw rolesError;

      if (!adminRoles || adminRoles.length === 0) {
        return [];
      }

      const adminUserIds = adminRoles.map((r) => r.user_id);

      // Get profiles for admin users
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .in('user_id', adminUserIds);

      if (profilesError) throw profilesError;

      const adminUsers: UserWithRole[] = (profiles || []).map((profile) => ({
        id: profile.id,
        user_id: profile.user_id,
        email: profile.email,
        full_name: profile.full_name,
        role: 'admin' as const,
        created_at: profile.created_at,
      }));

      return adminUsers;
    },
  });
}

// Fetch all non-super_admin users (admins and regular users/viewers)
export function useManageableUsers() {
  return useQuery({
    queryKey: ['manageable-users'],
    queryFn: async () => {
      // Get all user roles that are not super_admin
      const { data: userRoles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('role', ['admin', 'user']);

      if (rolesError) throw rolesError;

      if (!userRoles || userRoles.length === 0) {
        return [];
      }

      const userIds = userRoles.map((r) => r.user_id);

      // Get profiles for these users
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('*')
        .in('user_id', userIds);

      if (profilesError) throw profilesError;

      const users: UserWithRole[] = (profiles || []).map((profile) => {
        const userRole = userRoles.find((r) => r.user_id === profile.user_id);
        return {
          id: profile.id,
          user_id: profile.user_id,
          email: profile.email,
          full_name: profile.full_name,
          role: (userRole?.role || 'user') as 'admin' | 'user' | 'super_admin',
          created_at: profile.created_at,
        };
      });

      return users;
    },
  });
}
