import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

/**
 * A secondary Supabase client used by super-admin flows to create new auth
 * users without disturbing the currently signed-in admin's session.
 * It does NOT persist the session anywhere.
 */
export const adminAuthClient = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    storageKey: 'sb-admin-temp-auth',
  },
});

/**
 * Sign up a new auth user via the secondary client (so the caller's session
 * is untouched), then sign that temporary session out.
 * Returns the new user's id.
 */
export async function adminCreateAuthUser(email: string, password: string): Promise<string> {
  const { data, error } = await adminAuthClient.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${window.location.origin}/onboarding` },
  });
  if (error) throw error;
  const userId = data.user?.id;
  if (!userId) throw new Error('Failed to create user');
  // Immediately sign out the temporary client to keep it stateless.
  try { await adminAuthClient.auth.signOut(); } catch { /* ignore */ }
  return userId;
}
