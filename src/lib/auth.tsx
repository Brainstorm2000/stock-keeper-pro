import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

type AppRole = 'admin' | 'user' | 'super_admin' | 'super_super_admin';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  organizationId: string | null;
  hasCompletedOnboarding: boolean | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserProfile = async (userId: string) => {
    try {
      // Fetch profile to check if onboarding is complete
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('organization_id')
        .eq('user_id', userId)
        .single();

      if (profileError && profileError.code !== 'PGRST116') {
        console.error('Error fetching profile:', profileError);
      }

      const orgId = profile?.organization_id || null;
      setOrganizationId(orgId);
      setHasCompletedOnboarding(!!orgId);

      // Fetch role
      if (orgId) {
        const { data: roleData, error: roleError } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
          .single();

        if (roleError) {
          console.error('Error fetching role:', roleError);
          return null;
        }
        return roleData?.role as AppRole;
      }
      return null;
    } catch (err) {
      console.error('Error in fetchUserProfile:', err);
      return null;
    }
  };

  const refreshProfile = async () => {
    if (user) {
      const fetchedRole = await fetchUserProfile(user.id);
      setRole(fetchedRole);
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Defer profile/role fetching with setTimeout
        if (session?.user) {
          setTimeout(() => {
            fetchUserProfile(session.user.id).then(setRole);
          }, 0);
        } else {
          setRole(null);
          setOrganizationId(null);
          setHasCompletedOnboarding(null);
        }
        
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchUserProfile(session.user.id).then(setRole);
      }
      
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string) => {
    const redirectUrl = `${window.location.origin}/onboarding`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
      },
    });

    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRole(null);
    setOrganizationId(null);
    setHasCompletedOnboarding(null);
  };

  const value = {
    user,
    session,
    role,
    organizationId,
    hasCompletedOnboarding,
    isAdmin: role === 'admin' || role === 'super_admin',
    isSuperAdmin: role === 'super_admin',
    loading,
    signUp,
    signIn,
    signOut,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
