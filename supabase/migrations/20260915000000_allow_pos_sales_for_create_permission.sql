-- POS users with create permission must be able to complete sales.
-- The existing admin-only policies prevent non-admin POS operators from
-- using checkout even when the UI grants POS create access.
DROP POLICY IF EXISTS "Admins can manage sales" ON public.sales;
CREATE POLICY "Users with POS create access can insert sales"
ON public.sales FOR INSERT
WITH CHECK (
  is_same_organization(auth.uid(), organization_id)
  AND (
    is_super_admin(auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_module_permission(auth.uid(), 'pos'::app_module, 'create')
  )
);

CREATE POLICY "Admins can manage sales"
ON public.sales FOR ALL
USING (
  is_same_organization(auth.uid(), organization_id)
  AND (is_super_admin(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))
)
WITH CHECK (
  is_same_organization(auth.uid(), organization_id)
  AND (is_super_admin(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))
);

DROP POLICY IF EXISTS "Admins can manage sale items" ON public.sale_items;
CREATE POLICY "Users with POS create access can insert sale items"
ON public.sale_items FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.sales s
    WHERE s.id = sale_items.sale_id
      AND is_same_organization(auth.uid(), s.organization_id)
      AND (
        is_super_admin(auth.uid())
        OR has_role(auth.uid(), 'admin'::app_role)
        OR has_module_permission(auth.uid(), 'pos'::app_module, 'create')
      )
  )
);

CREATE POLICY "Admins can manage sale items"
ON public.sale_items FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.sales s
    WHERE s.id = sale_items.sale_id
      AND is_same_organization(auth.uid(), s.organization_id)
      AND (is_super_admin(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.sales s
    WHERE s.id = sale_items.sale_id
      AND is_same_organization(auth.uid(), s.organization_id)
      AND (is_super_admin(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))
  )
);