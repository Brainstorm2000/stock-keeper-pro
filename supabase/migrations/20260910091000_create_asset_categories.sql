CREATE TABLE public.asset_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);

CREATE INDEX asset_categories_organization_id_idx ON public.asset_categories(organization_id);

ALTER TABLE public.asset_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view asset categories in their organization"
ON public.asset_categories FOR SELECT
USING (public.is_same_organization(auth.uid(), organization_id));

CREATE POLICY "Admins can create asset categories in their organization"
ON public.asset_categories FOR INSERT
WITH CHECK (
  public.is_same_organization(auth.uid(), organization_id)
  AND public.has_module_permission(auth.uid(), 'assets'::public.app_module, 'create')
);

CREATE POLICY "Admins can update asset categories in their organization"
ON public.asset_categories FOR UPDATE
USING (
  public.is_same_organization(auth.uid(), organization_id)
  AND public.has_module_permission(auth.uid(), 'assets'::public.app_module, 'edit')
)
WITH CHECK (public.is_same_organization(auth.uid(), organization_id));

CREATE POLICY "Admins can delete asset categories in their organization"
ON public.asset_categories FOR DELETE
USING (
  public.is_same_organization(auth.uid(), organization_id)
  AND public.has_module_permission(auth.uid(), 'assets'::public.app_module, 'delete')
);

CREATE TRIGGER update_asset_categories_updated_at
BEFORE UPDATE ON public.asset_categories
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
