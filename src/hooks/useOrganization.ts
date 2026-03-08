import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { parseDbError } from '@/lib/db-errors';

export interface Organization {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  email: string | null;
  address: string | null;
  created_at: string;
  updated_at: string;
}

export interface OrganizationInput {
  name: string;
  slug: string;
  logo_url?: string;
  email?: string;
  address?: string;
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
    mutationFn: async ({ name, slug, fullName, logo_url, email, address }: OrganizationInput & { fullName: string }) => {
      if (!user) throw new Error('User not authenticated');

      // 1. Create the organization
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .insert({ name, slug, logo_url: logo_url || null, email: email || null, address: address || null })
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

      // 4. Auto-create a 14-day free trial subscription
      const now = new Date();
      const trialEnd = new Date(now);
      trialEnd.setDate(trialEnd.getDate() + 14);
      
      const subPayload: any = {
        organization_id: org.id,
        status: 'trial',
        trial_start_date: now.toISOString(),
        trial_end_date: trialEnd.toISOString(),
        number_of_users: 1,
        number_of_branches: 1,
        monthly_price: 0,
      };
      
      await supabase.from('organization_subscriptions').insert(subPayload);

      return org as Organization;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['organization'] });
      queryClient.invalidateQueries({ queryKey: ['user-profile'] });
      toast({ title: 'Organization created successfully' });
    },
    onError: (error: Error) => {
      const { title, description } = parseDbError(error, 'create organization');
      toast({ title, description, variant: 'destructive' });
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
        throw new Error('Organization not found. Please check the invite code and try again.');
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
      // Custom message for "not found" case
      if (error.message.includes('not found')) {
        toast({
          title: 'Organization not found',
          description: 'Please check the invite code and try again.',
          variant: 'destructive',
        });
        return;
      }
      const { title, description } = parseDbError(error, 'join organization');
      toast({ title, description, variant: 'destructive' });
    },
  });
}

export function useUpdateOrganization() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({
      id,
      name,
      email,
      address,
      logo_url,
    }: {
      id: string;
      name: string;
      email?: string | null;
      address?: string | null;
      logo_url?: string | null;
    }) => {
      const { data, error } = await supabase
        .from('organizations')
        .update({ name, email, address, logo_url })
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
      const { title, description } = parseDbError(error, 'update organization');
      toast({ title, description, variant: 'destructive' });
    },
  });
}
