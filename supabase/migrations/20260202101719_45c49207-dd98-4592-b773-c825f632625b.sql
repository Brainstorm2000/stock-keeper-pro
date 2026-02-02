-- Create enum for modules
CREATE TYPE public.app_module AS ENUM ('pos', 'sales', 'purchases', 'expenses');

-- Create enum for access levels
CREATE TYPE public.module_access_level AS ENUM ('none', 'view', 'create', 'full');

-- Create table for role-based default module permissions
CREATE TABLE public.role_module_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  module app_module NOT NULL,
  access_level module_access_level NOT NULL DEFAULT 'none',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(organization_id, role, module)
);

-- Create table for user-specific overrides (Super Admin can set these)
CREATE TABLE public.user_module_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  module app_module NOT NULL,
  access_level module_access_level NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, module)
);

-- Enable RLS
ALTER TABLE public.role_module_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_module_permissions ENABLE ROW LEVEL SECURITY;

-- RLS for role_module_permissions
CREATE POLICY "Users can view role permissions in their org"
ON public.role_module_permissions FOR SELECT
USING (is_same_organization(auth.uid(), organization_id));

CREATE POLICY "Super admins can manage role permissions in their org"
ON public.role_module_permissions FOR ALL
USING (is_super_admin(auth.uid()) AND is_same_organization(auth.uid(), organization_id))
WITH CHECK (is_super_admin(auth.uid()) AND is_same_organization(auth.uid(), organization_id));

-- RLS for user_module_permissions
CREATE POLICY "Users can view their own module permissions"
ON public.user_module_permissions FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Super admins can view user permissions in their org"
ON public.user_module_permissions FOR SELECT
USING (
  is_super_admin(auth.uid()) AND 
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = user_module_permissions.user_id 
    AND is_same_organization(auth.uid(), p.organization_id)
  )
);

CREATE POLICY "Super admins can manage user permissions in their org"
ON public.user_module_permissions FOR ALL
USING (
  is_super_admin(auth.uid()) AND 
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = user_module_permissions.user_id 
    AND is_same_organization(auth.uid(), p.organization_id)
  )
)
WITH CHECK (
  is_super_admin(auth.uid()) AND 
  EXISTS (
    SELECT 1 FROM public.profiles p 
    WHERE p.user_id = user_module_permissions.user_id 
    AND is_same_organization(auth.uid(), p.organization_id)
  )
);

-- Create function to get effective module access for a user
CREATE OR REPLACE FUNCTION public.get_module_access(_user_id UUID, _module app_module)
RETURNS module_access_level
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    -- First check for user-specific override
    (SELECT access_level FROM public.user_module_permissions 
     WHERE user_id = _user_id AND module = _module),
    -- Fall back to role-based permission
    (SELECT rmp.access_level 
     FROM public.role_module_permissions rmp
     JOIN public.profiles p ON p.organization_id = rmp.organization_id
     JOIN public.user_roles ur ON ur.user_id = p.user_id AND ur.role = rmp.role
     WHERE p.user_id = _user_id AND rmp.module = _module),
    -- Default: super_admin gets full, others get none
    CASE WHEN is_super_admin(_user_id) THEN 'full'::module_access_level ELSE 'none'::module_access_level END
  )
$$;

-- Create function to check if user has at least a certain access level
CREATE OR REPLACE FUNCTION public.has_module_access(_user_id UUID, _module app_module, _min_level module_access_level)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE 
    WHEN is_super_admin(_user_id) THEN true
    ELSE (
      SELECT CASE get_module_access(_user_id, _module)
        WHEN 'full' THEN true
        WHEN 'create' THEN _min_level IN ('none', 'view', 'create')
        WHEN 'view' THEN _min_level IN ('none', 'view')
        WHEN 'none' THEN _min_level = 'none'
        ELSE false
      END
    )
  END
$$;

-- Add updated_at triggers
CREATE TRIGGER update_role_module_permissions_updated_at
BEFORE UPDATE ON public.role_module_permissions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_module_permissions_updated_at
BEFORE UPDATE ON public.user_module_permissions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();