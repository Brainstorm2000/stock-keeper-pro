-- Allow any authenticated user in the same org to UPDATE attendance (for QR clock-out)
CREATE POLICY "Authenticated users can clock out for their org"
ON public.attendance
FOR UPDATE
TO authenticated
USING (is_same_organization(auth.uid(), organization_id))
WITH CHECK (is_same_organization(auth.uid(), organization_id));