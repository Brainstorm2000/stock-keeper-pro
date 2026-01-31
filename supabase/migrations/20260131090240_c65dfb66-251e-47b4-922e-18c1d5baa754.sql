-- Step 1: Create organizations table
CREATE TABLE public.organizations (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on organizations
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- Step 2: Add organization_id to profiles
ALTER TABLE public.profiles ADD COLUMN organization_id UUID REFERENCES public.organizations(id);

-- Step 3: Add organization_id to user_roles
ALTER TABLE public.user_roles ADD COLUMN organization_id UUID REFERENCES public.organizations(id);

-- Step 4: Add organization_id to branches
ALTER TABLE public.branches ADD COLUMN organization_id UUID REFERENCES public.organizations(id);

-- Step 5: Add organization_id to units
ALTER TABLE public.units ADD COLUMN organization_id UUID REFERENCES public.organizations(id);

-- Step 6: Clear existing data for fresh start
DELETE FROM public.stock_history;
DELETE FROM public.products;
DELETE FROM public.user_branch_assignments;
DELETE FROM public.branches;
DELETE FROM public.units;
DELETE FROM public.user_roles;
DELETE FROM public.profiles;

-- Step 7: Create function to get user's organization
CREATE OR REPLACE FUNCTION public.get_user_organization(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id
  FROM public.profiles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- Step 8: Update is_super_admin to be org-scoped
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.profiles p ON p.user_id = ur.user_id
    WHERE ur.user_id = _user_id
      AND ur.role = 'super_admin'
      AND ur.organization_id = p.organization_id
  )
$$;

-- Step 9: Update has_role to be org-scoped
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.profiles p ON p.user_id = ur.user_id
    WHERE ur.user_id = _user_id
      AND ur.role = _role
      AND ur.organization_id = p.organization_id
  )
$$;

-- Step 10: Function to check if user belongs to same org as a resource
CREATE OR REPLACE FUNCTION public.is_same_organization(_user_id UUID, _org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE user_id = _user_id
      AND organization_id = _org_id
  )
$$;

-- Step 11: Update has_branch_access to include org check
CREATE OR REPLACE FUNCTION public.has_branch_access(_user_id UUID, _branch_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    public.is_super_admin(_user_id) OR
    EXISTS (
      SELECT 1
      FROM public.user_branch_assignments uba
      JOIN public.branches b ON b.id = uba.branch_id
      JOIN public.profiles p ON p.user_id = uba.user_id
      WHERE uba.user_id = _user_id
        AND uba.branch_id = _branch_id
        AND b.organization_id = p.organization_id
    )
$$;

-- Step 12: Drop existing RLS policies and recreate with org-scoping

-- Organizations policies
CREATE POLICY "Users can view their own organization"
ON public.organizations FOR SELECT
USING (is_same_organization(auth.uid(), id));

CREATE POLICY "Super admins can update their organization"
ON public.organizations FOR UPDATE
USING (is_super_admin(auth.uid()) AND is_same_organization(auth.uid(), id));

-- Allow insert for new org creation during signup
CREATE POLICY "Authenticated users can create organizations"
ON public.organizations FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL);

-- Profiles policies (drop and recreate)
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view profiles" ON public.profiles;

CREATE POLICY "Users can insert their own profile"
ON public.profiles FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (user_id = auth.uid());

CREATE POLICY "Users can view profiles in their org"
ON public.profiles FOR SELECT
USING (
  user_id = auth.uid() OR 
  (organization_id IS NOT NULL AND is_same_organization(auth.uid(), organization_id))
);

-- User roles policies (drop and recreate)
DROP POLICY IF EXISTS "Admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can view all roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view roles" ON public.user_roles;

CREATE POLICY "Super admins can manage roles in their org"
ON public.user_roles FOR ALL
USING (is_super_admin(auth.uid()) AND is_same_organization(auth.uid(), organization_id));

CREATE POLICY "Users can view roles in their org"
ON public.user_roles FOR SELECT
USING (
  user_id = auth.uid() OR 
  is_same_organization(auth.uid(), organization_id)
);

CREATE POLICY "Users can insert their own initial role"
ON public.user_roles FOR INSERT
WITH CHECK (user_id = auth.uid());

-- Branches policies (drop and recreate)
DROP POLICY IF EXISTS "Super admins can manage all branches" ON public.branches;
DROP POLICY IF EXISTS "Users can view accessible branches" ON public.branches;

CREATE POLICY "Super admins can manage branches in their org"
ON public.branches FOR ALL
USING (is_super_admin(auth.uid()) AND is_same_organization(auth.uid(), organization_id));

CREATE POLICY "Users can view branches in their org"
ON public.branches FOR SELECT
USING (is_same_organization(auth.uid(), organization_id) AND 
  (is_super_admin(auth.uid()) OR has_branch_access(auth.uid(), id)));

-- Units policies (drop and recreate)
DROP POLICY IF EXISTS "Admins and super admins can delete units" ON public.units;
DROP POLICY IF EXISTS "Admins and super admins can insert units" ON public.units;
DROP POLICY IF EXISTS "Admins and super admins can update units" ON public.units;
DROP POLICY IF EXISTS "All authenticated users can view units" ON public.units;

CREATE POLICY "Admins can manage units in their org"
ON public.units FOR ALL
USING (
  (is_super_admin(auth.uid()) OR has_role(auth.uid(), 'admin')) 
  AND is_same_organization(auth.uid(), organization_id)
);

CREATE POLICY "Users can view units in their org"
ON public.units FOR SELECT
USING (is_same_organization(auth.uid(), organization_id));

-- Products policies (drop and recreate)
DROP POLICY IF EXISTS "Admins can delete products" ON public.products;
DROP POLICY IF EXISTS "Admins can insert products" ON public.products;
DROP POLICY IF EXISTS "Admins can update products" ON public.products;
DROP POLICY IF EXISTS "Users can view products in their branches" ON public.products;

CREATE POLICY "Admins can manage products in their branches"
ON public.products FOR ALL
USING (
  (is_super_admin(auth.uid()) OR (has_role(auth.uid(), 'admin') AND has_branch_access(auth.uid(), branch_id)))
);

CREATE POLICY "Users can view products in their org branches"
ON public.products FOR SELECT
USING (
  is_super_admin(auth.uid()) OR 
  (branch_id IS NULL) OR 
  has_branch_access(auth.uid(), branch_id)
);

-- User branch assignments policies (drop and recreate)
DROP POLICY IF EXISTS "Super admins can manage all assignments" ON public.user_branch_assignments;
DROP POLICY IF EXISTS "Users can view their own assignments" ON public.user_branch_assignments;

CREATE POLICY "Super admins can manage assignments in their org"
ON public.user_branch_assignments FOR ALL
USING (
  is_super_admin(auth.uid()) AND 
  EXISTS (
    SELECT 1 FROM public.branches b 
    WHERE b.id = branch_id 
    AND is_same_organization(auth.uid(), b.organization_id)
  )
);

CREATE POLICY "Users can view their own assignments"
ON public.user_branch_assignments FOR SELECT
USING (user_id = auth.uid());

-- Stock history policies remain unchanged (already rely on product access)

-- Step 13: Update handle_new_user trigger to NOT auto-create profile/role
-- (users will create these manually during onboarding)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Profile and role creation now handled in onboarding flow
    RETURN NEW;
END;
$$;

-- Recreate trigger (does nothing now, but keeps structure)
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Step 14: Add trigger for updated_at on organizations
CREATE TRIGGER update_organizations_updated_at
    BEFORE UPDATE ON public.organizations
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();