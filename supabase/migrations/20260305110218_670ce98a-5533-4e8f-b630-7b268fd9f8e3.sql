
-- Add branch_id to work_orders for branch-scoped production
ALTER TABLE public.work_orders ADD COLUMN branch_id uuid REFERENCES public.branches(id);

-- Allow admins to update stock_history (for managing damage records)
CREATE POLICY "Admins can update stock history" ON public.stock_history
FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM products p
  WHERE p.id = stock_history.product_id
  AND is_same_organization(auth.uid(), p.organization_id)
  AND (is_super_admin(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))
));

-- Allow admins to delete stock_history (for managing damage records)
CREATE POLICY "Admins can delete stock history" ON public.stock_history
FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM products p
  WHERE p.id = stock_history.product_id
  AND is_same_organization(auth.uid(), p.organization_id)
  AND (is_super_admin(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))
));

-- Allow admins to update raw_material_stock_history (for managing waste records)
CREATE POLICY "Admins can update raw material stock history" ON public.raw_material_stock_history
FOR UPDATE TO authenticated
USING (EXISTS (
  SELECT 1 FROM raw_materials rm
  WHERE rm.id = raw_material_stock_history.raw_material_id
  AND is_same_organization(auth.uid(), rm.organization_id)
  AND (is_super_admin(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))
));

-- Allow admins to delete raw_material_stock_history (for managing waste records)
CREATE POLICY "Admins can delete raw material stock history" ON public.raw_material_stock_history
FOR DELETE TO authenticated
USING (EXISTS (
  SELECT 1 FROM raw_materials rm
  WHERE rm.id = raw_material_stock_history.raw_material_id
  AND is_same_organization(auth.uid(), rm.organization_id)
  AND (is_super_admin(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))
));
