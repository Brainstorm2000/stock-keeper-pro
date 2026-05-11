
ALTER TABLE public.purchases ADD COLUMN IF NOT EXISTS receipt_url text;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('purchase-receipts', 'purchase-receipts', false, 10485760, ARRAY['image/jpeg','image/jpg','image/png'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = 10485760, allowed_mime_types = ARRAY['image/jpeg','image/jpg','image/png'];

-- RLS policies on storage.objects for purchase-receipts
DROP POLICY IF EXISTS "Org members can view purchase receipts" ON storage.objects;
CREATE POLICY "Org members can view purchase receipts"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'purchase-receipts'
  AND public.is_same_organization(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

DROP POLICY IF EXISTS "Admins can upload purchase receipts" ON storage.objects;
CREATE POLICY "Admins can upload purchase receipts"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'purchase-receipts'
  AND public.is_same_organization(auth.uid(), ((storage.foldername(name))[1])::uuid)
  AND (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role))
);

DROP POLICY IF EXISTS "Admins can update purchase receipts" ON storage.objects;
CREATE POLICY "Admins can update purchase receipts"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'purchase-receipts'
  AND public.is_same_organization(auth.uid(), ((storage.foldername(name))[1])::uuid)
  AND (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role))
);

DROP POLICY IF EXISTS "Admins can delete purchase receipts" ON storage.objects;
CREATE POLICY "Admins can delete purchase receipts"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'purchase-receipts'
  AND public.is_same_organization(auth.uid(), ((storage.foldername(name))[1])::uuid)
  AND (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role))
);
