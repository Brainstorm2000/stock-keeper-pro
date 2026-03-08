
-- Create organization_modules table to track which modules are enabled per org
CREATE TABLE public.organization_modules (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  module public.app_module NOT NULL,
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(organization_id, module)
);

-- Enable RLS
ALTER TABLE public.organization_modules ENABLE ROW LEVEL SECURITY;

-- Super super admins can manage all org modules
CREATE POLICY "Super super admins can manage org modules"
  ON public.organization_modules
  FOR ALL
  USING (public.is_super_super_admin(auth.uid()))
  WITH CHECK (public.is_super_super_admin(auth.uid()));

-- Users can view their own org's modules
CREATE POLICY "Users can view their org modules"
  ON public.organization_modules
  FOR SELECT
  USING (public.is_same_organization(auth.uid(), organization_id));

-- Super admins can view org modules (for their org)
CREATE POLICY "Super admins can manage their org modules"
  ON public.organization_modules
  FOR ALL
  USING (public.is_super_admin(auth.uid()) AND public.is_same_organization(auth.uid(), organization_id))
  WITH CHECK (public.is_super_admin(auth.uid()) AND public.is_same_organization(auth.uid(), organization_id));

-- Create a function to check if a module is enabled for an org
CREATE OR REPLACE FUNCTION public.is_module_enabled_for_org(_org_id uuid, _module public.app_module)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_enabled FROM public.organization_modules WHERE organization_id = _org_id AND module = _module),
    true -- default: enabled if no record exists
  )
$$;
