CREATE POLICY "Super super admins can view all branches"
ON public.branches
FOR SELECT
TO authenticated
USING (is_super_super_admin(auth.uid()));