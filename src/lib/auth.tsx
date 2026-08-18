import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AppRole = "admin" | "user" | "super_admin" | "super_super_admin";

export function isMissingRowError(error: { code?: string; message?: string; status?: number } | null | undefined) {
  if (!error) return false;

  const code = (error.code ?? "").toLowerCase();
  const message = (error.message ?? "").toLowerCase();
  const status = error.status;

  return (
    status === 406 ||
    code === "pgrst116" ||
    message.includes("pgrst116") ||
    message.includes("no rows returned") ||
    message.includes("multiple (or no) rows returned") ||
    message.includes("multiple or no rows returned")
  );
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  organizationId: string | null;
  isOrgDisabled: boolean;
  hasCompletedOnboarding: boolean | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  isSuperSuperAdmin: boolean;
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
  const [isOrgDisabled, setIsOrgDisabled] = useState(false);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState<
    boolean | null
  >(null);
  const [loading, setLoading] = useState(true);

  const fetchUserProfile = async (userId: string) => {
    try {
      // First check if user has super_super_admin role (no org needed). Some users
      // may not have a row in user_roles yet, which should be treated as "no role"
      // rather than a fatal auth error.
      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();

      if (!roleError && roleData?.role === "super_super_admin") {
        setOrganizationId(null);
        setHasCompletedOnboarding(true);
        setIsOrgDisabled(false);
        return "super_super_admin" as AppRole;
      }

      if (roleError && !isMissingRowError(roleError)) {
        console.error("Error fetching role:", roleError);
      }

      // Fetch profile to check if onboarding is complete.
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("user_id", userId)
        .maybeSingle();

      if (profileError && !isMissingRowError(profileError)) {
        console.error("Error fetching profile:", profileError);
      }

      const orgId = profile?.organization_id || null;
      setOrganizationId(orgId);
      setHasCompletedOnboarding(!!orgId);

      // Check if organization is active. A deleted org should not log the user out.
      if (orgId) {
        const { data: org, error: orgError } = await supabase
          .from("organizations")
          .select("is_active")
          .eq("id", orgId)
          .maybeSingle();

        if (orgError && !isMissingRowError(orgError)) {
          console.error("Error fetching organization:", orgError);
        }

        setIsOrgDisabled(org?.is_active === false);
      } else {
        setIsOrgDisabled(false);
      }

      // Fetch role
      if (orgId) {
        return (roleData?.role as AppRole) || null;
      }
      return null;
    } catch (err) {
      console.error("Error in fetchUserProfile:", err);
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
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      setUser(session?.user ?? null);

      // Defer profile/role fetching with setTimeout
      if (session?.user) {
        setTimeout(() => {
          fetchUserProfile(session.user.id).then((r) => {
            setRole(r);
            setLoading(false);
          });
        }, 0);
      } else {
        setRole(null);
        setOrganizationId(null);
        setHasCompletedOnboarding(null);
        setIsOrgDisabled(false);
        setLoading(false);
      }
    });

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      if (session?.user) {
        fetchUserProfile(session.user.id).then((r) => {
          setRole(r);
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
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
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (!error && data.user) {
      // Enforce is_active flag client-side (no server-side auth ban available).
      const { data: profile } = await supabase
        .from("profiles")
        .select("is_active")
        .eq("user_id", data.user.id)
        .maybeSingle();
      if (profile && profile.is_active === false) {
        await supabase.auth.signOut();
        return {
          error: new Error(
            "This account has been deactivated. Please contact your administrator if you believe this is an error.",
          ),
        };
      }
    }

    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRole(null);
    setOrganizationId(null);
    setHasCompletedOnboarding(null);
    setIsOrgDisabled(false);
  };

  const value = {
    user,
    session,
    role,
    organizationId,
    isOrgDisabled,
    hasCompletedOnboarding,
    isAdmin:
      role === "admin" ||
      role === "super_admin" ||
      role === "super_super_admin",
    isSuperAdmin: role === "super_admin" || role === "super_super_admin",
    isSuperSuperAdmin: role === "super_super_admin",
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
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
