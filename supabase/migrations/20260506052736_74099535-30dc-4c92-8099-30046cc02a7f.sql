
-- =========================================================
-- 1. PROFILES: restrict SELECT to self + org admins + platform admins
-- =========================================================
DROP POLICY IF EXISTS "Users can view profiles in their org" ON public.profiles;

CREATE POLICY "Users can view their own or admin-visible profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_super_super_admin(auth.uid())
  OR (
    organization_id IS NOT NULL
    AND public.is_same_organization(auth.uid(), organization_id)
    AND (
      public.is_super_admin(auth.uid())
      OR public.has_role(auth.uid(), 'admin'::app_role)
    )
  )
);

-- Helper RPC: fetch colleague display names (no email) within same org
CREATE OR REPLACE FUNCTION public.get_org_user_names(_user_ids uuid[])
RETURNS TABLE(user_id uuid, full_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id, p.full_name
  FROM public.profiles p
  WHERE p.user_id = ANY(_user_ids)
    AND (
      public.is_super_super_admin(auth.uid())
      OR (
        p.organization_id IS NOT NULL
        AND p.organization_id = public.get_user_organization(auth.uid())
      )
    )
$$;

REVOKE EXECUTE ON FUNCTION public.get_org_user_names(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_org_user_names(uuid[]) TO authenticated;

-- =========================================================
-- 2. PURCHASES: restrict SELECT to admins / super_admins
-- =========================================================
DROP POLICY IF EXISTS "Users can view purchases in their org" ON public.purchases;

CREATE POLICY "Admins can view purchases in their org"
ON public.purchases
FOR SELECT
TO authenticated
USING (
  public.is_same_organization(auth.uid(), organization_id)
  AND (
    public.is_super_admin(auth.uid())
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
);

-- =========================================================
-- 3. HELD_ORDERS: drop branch_id IS NULL allowance
-- =========================================================
DROP POLICY IF EXISTS "Users can view held orders in their org" ON public.held_orders;

CREATE POLICY "Users can view held orders for branches they access"
ON public.held_orders
FOR SELECT
TO authenticated
USING (
  public.is_same_organization(auth.uid(), organization_id)
  AND (
    public.is_super_admin(auth.uid())
    OR (branch_id IS NOT NULL AND public.has_branch_access(auth.uid(), branch_id))
  )
);

-- =========================================================
-- 4. ORGANIZATIONS: replace permissive INSERT with super_super_admin only
-- =========================================================
DROP POLICY IF EXISTS "Authenticated users can create organizations" ON public.organizations;

CREATE POLICY "Only platform super admins can create organizations"
ON public.organizations
FOR INSERT
TO authenticated
WITH CHECK (public.is_super_super_admin(auth.uid()));

-- =========================================================
-- 5. ORG-LOGOS storage: tighten write policies (keep public read)
-- =========================================================
DROP POLICY IF EXISTS "Authenticated users can upload org logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update org logos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete org logos" ON storage.objects;

CREATE POLICY "Org admins can upload org logos"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'org-logos'
  AND (
    public.is_super_super_admin(auth.uid())
    OR public.is_super_admin(auth.uid())
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
);

CREATE POLICY "Org admins can update org logos"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'org-logos'
  AND (
    public.is_super_super_admin(auth.uid())
    OR public.is_super_admin(auth.uid())
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
);

CREATE POLICY "Org admins can delete org logos"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'org-logos'
  AND (
    public.is_super_super_admin(auth.uid())
    OR public.is_super_admin(auth.uid())
    OR public.has_role(auth.uid(), 'admin'::app_role)
  )
);

-- =========================================================
-- 6. NUMBER GENERATORS: per-org advisory lock to avoid race conditions
-- =========================================================
CREATE OR REPLACE FUNCTION public.generate_sale_number(org_id uuid)
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
  next_num integer;
BEGIN
  -- Per-org transactional lock: concurrent calls for same org wait
  PERFORM pg_advisory_xact_lock(hashtext('sale_number:' || org_id::text));

  SELECT COALESCE(MAX(CAST(SUBSTRING(sale_number FROM 5) AS integer)), 0) + 1
  INTO next_num
  FROM public.sales
  WHERE organization_id = org_id;

  RETURN 'INV-' || LPAD(next_num::text, 5, '0');
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_purchase_number(org_id uuid)
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
  next_num integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('purchase_number:' || org_id::text));

  SELECT COALESCE(MAX(CAST(SUBSTRING(purchase_number FROM 4) AS integer)), 0) + 1
  INTO next_num
  FROM public.purchases
  WHERE organization_id = org_id;

  RETURN 'PO-' || LPAD(next_num::text, 5, '0');
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_sale_return_number(org_id uuid)
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE next_num integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('sale_return_number:' || org_id::text));

  SELECT COALESCE(MAX(CAST(SUBSTRING(return_number FROM 4) AS integer)), 0) + 1
  INTO next_num FROM public.sale_returns WHERE organization_id = org_id;
  RETURN 'SR-' || LPAD(next_num::text, 5, '0');
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_purchase_return_number(org_id uuid)
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE next_num integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('purchase_return_number:' || org_id::text));

  SELECT COALESCE(MAX(CAST(SUBSTRING(return_number FROM 4) AS integer)), 0) + 1
  INTO next_num FROM public.purchase_returns WHERE organization_id = org_id;
  RETURN 'PR-' || LPAD(next_num::text, 5, '0');
END;
$function$;

CREATE OR REPLACE FUNCTION public.generate_work_order_number(org_id uuid)
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
  next_num integer;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('work_order_number:' || org_id::text));

  SELECT COALESCE(MAX(CAST(SUBSTRING(work_order_number FROM 4) AS integer)), 0) + 1
  INTO next_num
  FROM public.work_orders
  WHERE organization_id = org_id;

  RETURN 'WO-' || LPAD(next_num::text, 5, '0');
END;
$function$;
