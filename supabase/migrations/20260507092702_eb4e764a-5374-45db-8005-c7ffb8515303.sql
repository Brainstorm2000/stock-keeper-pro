-- Make get_org_user_names also return names for super_super_admins (no org) and platform users.
CREATE OR REPLACE FUNCTION public.get_org_user_names(_user_ids uuid[])
RETURNS TABLE(user_id uuid, full_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.user_id, p.full_name
  FROM public.profiles p
  WHERE p.user_id = ANY(_user_ids)
    AND (
      public.is_super_super_admin(auth.uid())
      OR p.user_id = auth.uid()
      OR (
        p.organization_id IS NOT NULL
        AND p.organization_id = public.get_user_organization(auth.uid())
      )
      OR EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = p.user_id AND ur.role = 'super_super_admin'
      )
    )
$$;