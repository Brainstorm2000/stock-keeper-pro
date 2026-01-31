-- Update the products RLS policy to handle null branch_id for admins
DROP POLICY IF EXISTS "Admins can manage products in their branches" ON public.products;

CREATE POLICY "Admins can manage products in their branches"
ON public.products FOR ALL
TO authenticated
USING (
  is_super_admin(auth.uid()) 
  OR (
    has_role(auth.uid(), 'admin'::app_role) 
    AND (
      branch_id IS NULL 
      OR has_branch_access(auth.uid(), branch_id)
    )
  )
)
WITH CHECK (
  is_super_admin(auth.uid()) 
  OR (
    has_role(auth.uid(), 'admin'::app_role) 
    AND (
      branch_id IS NULL 
      OR has_branch_access(auth.uid(), branch_id)
    )
  )
);