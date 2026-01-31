-- Create storage bucket for organization logos
INSERT INTO storage.buckets (id, name, public)
VALUES ('org-logos', 'org-logos', true);

-- Allow authenticated users to upload logos
CREATE POLICY "Authenticated users can upload org logos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'org-logos');

-- Allow public read access to logos
CREATE POLICY "Anyone can view org logos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'org-logos');

-- Allow authenticated users to update their uploads
CREATE POLICY "Authenticated users can update org logos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'org-logos');

-- Allow authenticated users to delete logos
CREATE POLICY "Authenticated users can delete org logos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'org-logos');