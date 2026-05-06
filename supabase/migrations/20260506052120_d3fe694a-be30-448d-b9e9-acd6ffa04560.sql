CREATE POLICY "Super super admins can view all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.is_super_super_admin(auth.uid()));