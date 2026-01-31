import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  updated_at: string;
}

export interface OrganizationInput {
  name: string;
  slug: string;
}

export function useOrganization() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['organization', user?.id],
    queryFn: async () => {
      if (!user) return null;

      // First get the user's profile to find their org
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('user_id', user.id)
        .single();

      if (profileError || !profile?.organization_id) {
        return null;
      }

      // Then fetch the organization
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', profile.organization_id)
        .single();

      if (orgError) throw orgError;
      return org as Organization;
    },
    enabled: !!user,
  });
}

export function useUserProfile() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['user-profile', user?.id],
    queryFn: async () => {
      if (!user) return null;

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useCreateOrganization() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ name, slug, fullName }: OrganizationInput & { fullName: string }) => {
      if (!user) throw new Error('User not authenticated');

      // 1. Create the organization
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .insert({ name, slug })
        .select()
        .single();

      if (orgError) throw orgError;

      // 2. Create user profile with organization
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          user_id: user.id,
          email: user.email,
          full_name: fullName,
          organization_id: org.id,
        });

      if (profileError) throw profileError;

      // 3. Create user role as super_admin for their org
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: user.id,
          role: 'super_admin',
          organization_id: org.id,
        });

      if (roleError) throw roleError;

      return org as Organization;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization'] });
      queryClient.invalidateQueries({ queryKey: ['user-profile'] });
      toast({ title: 'Organization created successfully' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to create organization',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useJoinOrganization() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ slug, fullName, role }: { slug: string; fullName: string; role: 'admin' | 'user' }) => {
      if (!user) throw new Error('User not authenticated');

      // 1. Find the organization by slug
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('*')
        .eq('slug', slug)
        .single();

      if (orgError || !org) {
        throw new Error('Organization not found. Please check the invite code.');
      }

      // 2. Create user profile with organization
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          user_id: user.id,
          email: user.email,
          full_name: fullName,
          organization_id: org.id,
        });

      if (profileError) throw profileError;

      // 3. Create user role (admin or viewer)
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: user.id,
          role: role,
          organization_id: org.id,
        });

      if (roleError) throw roleError;

      return org as Organization;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization'] });
      queryClient.invalidateQueries({ queryKey: ['user-profile'] });
      toast({ title: 'Joined organization successfully' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to join organization',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateOrganization() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { data, error } = await supabase
        .from('organizations')
        .update({ name })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as Organization;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization'] });
      toast({ title: 'Organization updated successfully' });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to update organization',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
}
