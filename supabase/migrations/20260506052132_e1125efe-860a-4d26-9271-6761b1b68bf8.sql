DROP POLICY IF EXISTS "Users can view profiles in their org" ON public.profiles;
CREATE POLICY "Users can view profiles in their org"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR (organization_id IS NOT NULL AND public.is_same_organization(auth.uid(), organization_id))
  OR public.is_super_super_admin(auth.uid())
);