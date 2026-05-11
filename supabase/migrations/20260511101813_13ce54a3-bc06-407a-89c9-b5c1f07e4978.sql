
-- 1) PRIVILEGE ESCALATION: restrict self-insert on user_roles to role='user'
DROP POLICY IF EXISTS "Users can insert their own initial role" ON public.user_roles;
CREATE POLICY "Users can insert their own initial user role"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND role = 'user'::app_role
  AND NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid())
);

-- 2) ORGANIZATIONS: restrict SELECT to same-org members or platform super admins
DROP POLICY IF EXISTS "Users can view organizations" ON public.organizations;
CREATE POLICY "Users can view their organization"
ON public.organizations
FOR SELECT
TO authenticated
USING (
  is_super_super_admin(auth.uid())
  OR is_same_organization(auth.uid(), id)
);

-- 3) STAFF: restrict SELECT to org admins / super admins only
DROP POLICY IF EXISTS "Users can view staff in their org" ON public.staff;
CREATE POLICY "Admins can view staff in their org"
ON public.staff
FOR SELECT
TO authenticated
USING (
  is_same_organization(auth.uid(), organization_id)
  AND (is_super_admin(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))
);

-- 4) EXPENSE RECEIPTS STORAGE: private + org-scoped policies
UPDATE storage.buckets SET public = false WHERE id = 'expense-receipts';

DROP POLICY IF EXISTS "Public can read expense receipts" ON storage.objects;
DROP POLICY IF EXISTS "Users can view expense receipts in their org" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload expense receipts" ON storage.objects;
DROP POLICY IF EXISTS "Admins can update expense receipts" ON storage.objects;
DROP POLICY IF EXISTS "Admins can delete expense receipts" ON storage.objects;

-- Files are stored under "<organization_id>/<uuid>.<ext>" — first folder is the org id.
CREATE POLICY "Org members can view expense receipts"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'expense-receipts'
  AND (storage.foldername(name))[1] = (
    SELECT organization_id::text FROM public.profiles WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Org admins can upload expense receipts"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'expense-receipts'
  AND (storage.foldername(name))[1] = (
    SELECT organization_id::text FROM public.profiles WHERE user_id = auth.uid()
  )
  AND (is_super_admin(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))
);

CREATE POLICY "Org admins can update expense receipts"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'expense-receipts'
  AND (storage.foldername(name))[1] = (
    SELECT organization_id::text FROM public.profiles WHERE user_id = auth.uid()
  )
  AND (is_super_admin(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))
);

CREATE POLICY "Org admins can delete expense receipts"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'expense-receipts'
  AND (storage.foldername(name))[1] = (
    SELECT organization_id::text FROM public.profiles WHERE user_id = auth.uid()
  )
  AND (is_super_admin(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))
);
