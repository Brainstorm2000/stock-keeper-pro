CREATE TABLE public.assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'In Storage' CHECK (status IN ('In Use', 'In Storage', 'Under Maintenance', 'Written Off', 'Disposed')),
  custodian_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  purchase_cost NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (purchase_cost >= 0),
  purchase_date DATE,
  maintenance_required BOOLEAN NOT NULL DEFAULT false,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (organization_id, tag_id)
);

CREATE INDEX assets_organization_id_idx ON public.assets(organization_id);
CREATE INDEX assets_branch_id_idx ON public.assets(branch_id);
CREATE INDEX assets_custodian_id_idx ON public.assets(custodian_id);

ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view assets in their organization"
ON public.assets FOR SELECT
USING (public.is_same_organization(auth.uid(), organization_id));

CREATE POLICY "Admins can create assets in their organization"
ON public.assets FOR INSERT
WITH CHECK (
  public.is_same_organization(auth.uid(), organization_id)
  AND public.has_module_permission(auth.uid(), 'assets'::public.app_module, 'create')
);

CREATE POLICY "Admins can update assets in their organization"
ON public.assets FOR UPDATE
USING (
  public.is_same_organization(auth.uid(), organization_id)
  AND public.has_module_permission(auth.uid(), 'assets'::public.app_module, 'edit')
)
WITH CHECK (public.is_same_organization(auth.uid(), organization_id));

CREATE POLICY "Admins can delete assets in their organization"
ON public.assets FOR DELETE
USING (
  public.is_same_organization(auth.uid(), organization_id)
  AND public.has_module_permission(auth.uid(), 'assets'::public.app_module, 'delete')
);

CREATE TRIGGER update_assets_updated_at
BEFORE UPDATE ON public.assets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.role_module_permissions (organization_id, role, module, can_view, can_create, can_edit, can_delete)
SELECT id, role, 'assets'::public.app_module, true, true, true, true
FROM public.organizations
CROSS JOIN (VALUES ('admin'::public.app_role), ('user'::public.app_role)) AS roles(role)
ON CONFLICT (organization_id, role, module) DO NOTHING;
