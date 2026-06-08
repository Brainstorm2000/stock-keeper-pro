
DROP FUNCTION IF EXISTS public.get_org_user_names(uuid[]);

CREATE OR REPLACE FUNCTION public.get_org_user_names(_user_ids uuid[])
RETURNS TABLE(user_id uuid, full_name text, email text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.user_id,
    p.full_name,
    u.email::text
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.user_id
  WHERE p.user_id = ANY(_user_ids)
    AND auth.uid() IS NOT NULL
$$;

GRANT EXECUTE ON FUNCTION public.get_org_user_names(uuid[]) TO authenticated;
