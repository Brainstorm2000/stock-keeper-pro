-- Drop the overly permissive SELECT policy
DROP POLICY IF EXISTS "All authenticated users can view stock history" ON public.stock_history;

-- Create new policy that filters by organization through products table
CREATE POLICY "Users can view stock history for their org products"
ON public.stock_history
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = stock_history.product_id
      AND is_same_organization(auth.uid(), p.organization_id)
      AND (
        is_super_admin(auth.uid())
        OR p.branch_id IS NULL
        OR has_branch_access(auth.uid(), p.branch_id)
      )
  )
);

-- Update INSERT policy to also check organization access
DROP POLICY IF EXISTS "Admins and super admins can insert stock history" ON public.stock_history;

CREATE POLICY "Admins can insert stock history for their org products"
ON public.stock_history
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.products p
    WHERE p.id = stock_history.product_id
      AND is_same_organization(auth.uid(), p.organization_id)
      AND (is_super_admin(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))
  )
);