
-- Create a function to check if user is super_super_admin
CREATE OR REPLACE FUNCTION public.is_super_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'super_super_admin'
  )
$$;

-- Allow super_super_admin to update any organization
DROP POLICY IF EXISTS "Super admins can update their organization" ON public.organizations;
CREATE POLICY "Super admins can update their organization" ON public.organizations
FOR UPDATE USING (
  is_super_super_admin(auth.uid()) OR (is_super_admin(auth.uid()) AND is_same_organization(auth.uid(), id))
);

-- Allow super_super_admin to delete organizations
CREATE POLICY "Super super admins can delete organizations" ON public.organizations
FOR DELETE USING (
  is_super_super_admin(auth.uid())
);

-- Allow super_super_admin to view all profiles
DROP POLICY IF EXISTS "Users can view profiles in their org" ON public.profiles;
CREATE POLICY "Users can view profiles in their org" ON public.profiles
FOR SELECT USING (
  (user_id = auth.uid()) OR 
  ((organization_id IS NOT NULL) AND is_same_organization(auth.uid(), organization_id)) OR
  is_super_super_admin(auth.uid())
);

-- Allow super_super_admin to view all user roles
DROP POLICY IF EXISTS "Users can view roles in their org" ON public.user_roles;
CREATE POLICY "Users can view roles in their org" ON public.user_roles
FOR SELECT USING (
  (user_id = auth.uid()) OR 
  is_same_organization(auth.uid(), organization_id) OR
  is_super_super_admin(auth.uid())
);
