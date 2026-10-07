DROP POLICY IF EXISTS "Users with product edit permission can update accessible products" ON public.products;

CREATE POLICY "Users with product edit permission can update accessible products"
  ON public.products
  FOR UPDATE TO authenticated
  USING (
    public.is_same_organization(auth.uid(), organization_id)
    AND public.has_module_permission(auth.uid(), 'products'::app_module, 'edit')
    AND (branch_id IS NULL OR public.has_branch_access(auth.uid(), branch_id))
  )
  WITH CHECK (
    public.is_same_organization(auth.uid(), organization_id)
    AND public.has_module_permission(auth.uid(), 'products'::app_module, 'edit')
    AND (branch_id IS NULL OR public.has_branch_access(auth.uid(), branch_id))
  );