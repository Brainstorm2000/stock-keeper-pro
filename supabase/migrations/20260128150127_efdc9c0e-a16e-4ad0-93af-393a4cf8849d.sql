-- Update products SELECT policy to restrict admins to their assigned branches
DROP POLICY IF EXISTS "All authenticated users can view products" ON public.products;
CREATE POLICY "Users can view products in their branches"
ON public.products
FOR SELECT
USING (
  public.is_super_admin(auth.uid()) OR
  (branch_id IS NULL) OR
  public.has_branch_access(auth.uid(), branch_id)
);

-- Update products INSERT policy - remove branch_id IS NULL escape for admins
DROP POLICY IF EXISTS "Admins can insert products" ON public.products;
CREATE POLICY "Admins can insert products"
ON public.products
FOR INSERT
WITH CHECK (
  public.is_super_admin(auth.uid()) OR
  (public.has_role(auth.uid(), 'admin'::app_role) AND public.has_branch_access(auth.uid(), branch_id))
);

-- Update products UPDATE policy
DROP POLICY IF EXISTS "Admins can update products" ON public.products;
CREATE POLICY "Admins can update products"
ON public.products
FOR UPDATE
USING (
  public.is_super_admin(auth.uid()) OR
  (public.has_role(auth.uid(), 'admin'::app_role) AND public.has_branch_access(auth.uid(), branch_id))
);

-- Update products DELETE policy
DROP POLICY IF EXISTS "Admins can delete products" ON public.products;
CREATE POLICY "Admins can delete products"
ON public.products
FOR DELETE
USING (
  public.is_super_admin(auth.uid()) OR
  (public.has_role(auth.uid(), 'admin'::app_role) AND public.has_branch_access(auth.uid(), branch_id))
);

-- Update branches SELECT policy - admins see only their assigned branches
DROP POLICY IF EXISTS "Users can view all branches" ON public.branches;
CREATE POLICY "Users can view accessible branches"
ON public.branches
FOR SELECT
USING (
  public.is_super_admin(auth.uid()) OR
  public.has_branch_access(auth.uid(), id)
);