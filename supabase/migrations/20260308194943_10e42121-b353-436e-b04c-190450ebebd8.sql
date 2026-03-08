
-- Add is_active column to profiles for user activation/deactivation
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Allow super_super_admin to update any profile
CREATE POLICY "Super super admins can update any profile"
ON public.profiles
FOR UPDATE
USING (is_super_super_admin(auth.uid()))
WITH CHECK (is_super_super_admin(auth.uid()));

-- Allow super_super_admin to delete any profile
CREATE POLICY "Super super admins can delete profiles"
ON public.profiles
FOR DELETE
USING (is_super_super_admin(auth.uid()));

-- Allow super_super_admin to insert profiles for others
CREATE POLICY "Super super admins can insert any profile"
ON public.profiles
FOR INSERT
WITH CHECK (is_super_super_admin(auth.uid()));

-- Allow super_super_admin to manage all user roles
CREATE POLICY "Super super admins can manage all roles"
ON public.user_roles
FOR ALL
USING (is_super_super_admin(auth.uid()))
WITH CHECK (is_super_super_admin(auth.uid()));
