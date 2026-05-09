-- Make expense-receipts bucket public so stored public URLs work
UPDATE storage.buckets SET public = true WHERE id = 'expense-receipts';

-- Ensure public read access policy exists
DROP POLICY IF EXISTS "Public can read expense receipts" ON storage.objects;
CREATE POLICY "Public can read expense receipts"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'expense-receipts');