DROP POLICY IF EXISTS "Users can view assets in their organization" ON public.assets;
DROP POLICY IF EXISTS "Admins can create assets in their organization" ON public.assets;
DROP POLICY IF EXISTS "Admins can update assets in their organization" ON public.assets;
DROP POLICY IF EXISTS "Admins can delete assets in their organization" ON public.assets;

CREATE POLICY "Users can view assets in their assigned branches"
ON public.assets FOR SELECT
USING (
  public.is_same_organization(auth.uid(), organization_id)
  AND (
    public.is_super_admin(auth.uid())
    OR (
      branch_id IS NOT NULL
      AND public.has_branch_access(auth.uid(), branch_id)
    )
  )
);

CREATE POLICY "Admins can create assets in their assigned branches"
ON public.assets FOR INSERT
WITH CHECK (
  public.is_same_organization(auth.uid(), organization_id)
  AND public.has_module_permission(auth.uid(), 'assets'::public.app_module, 'create')
  AND (
    public.is_super_admin(auth.uid())
    OR (
      branch_id IS NOT NULL
      AND public.has_branch_access(auth.uid(), branch_id)
    )
  )
);

CREATE POLICY "Admins can update assets in their assigned branches"
ON public.assets FOR UPDATE
USING (
  public.is_same_organization(auth.uid(), organization_id)
  AND public.has_module_permission(auth.uid(), 'assets'::public.app_module, 'edit')
  AND (
    public.is_super_admin(auth.uid())
    OR (
      branch_id IS NOT NULL
      AND public.has_branch_access(auth.uid(), branch_id)
    )
  )
)
WITH CHECK (
  public.is_same_organization(auth.uid(), organization_id)
  AND (
    public.is_super_admin(auth.uid())
    OR (
      branch_id IS NOT NULL
      AND public.has_branch_access(auth.uid(), branch_id)
    )
  )
);

CREATE POLICY "Admins can delete assets in their assigned branches"
ON public.assets FOR DELETE
USING (
  public.is_same_organization(auth.uid(), organization_id)
  AND public.has_module_permission(auth.uid(), 'assets'::public.app_module, 'delete')
  AND (
    public.is_super_admin(auth.uid())
    OR (
      branch_id IS NOT NULL
      AND public.has_branch_access(auth.uid(), branch_id)
    )
  )
);
