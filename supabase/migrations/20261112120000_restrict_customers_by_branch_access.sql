DROP POLICY IF EXISTS "Users can view customers in their org" ON public.customers;
DROP POLICY IF EXISTS "Admins can manage customers" ON public.customers;

CREATE POLICY "Users can view customers in branches they access"
ON public.customers
FOR SELECT
TO authenticated
USING (
  public.is_same_organization(auth.uid(), organization_id)
  AND branch_id IS NOT NULL
  AND public.has_branch_access(auth.uid(), branch_id)
);

CREATE POLICY "Admins can manage customers in branches they access"
ON public.customers
FOR ALL
TO authenticated
USING (
  public.is_same_organization(auth.uid(), organization_id)
  AND branch_id IS NOT NULL
  AND public.has_branch_access(auth.uid(), branch_id)
  AND (
    public.is_super_admin(auth.uid())
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
)
WITH CHECK (
  public.is_same_organization(auth.uid(), organization_id)
  AND branch_id IS NOT NULL
  AND public.has_branch_access(auth.uid(), branch_id)
  AND (
    public.is_super_admin(auth.uid())
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
);
