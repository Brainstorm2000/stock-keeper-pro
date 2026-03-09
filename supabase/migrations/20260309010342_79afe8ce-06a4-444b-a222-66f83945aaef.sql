-- Allow any authenticated user in the same org to INSERT attendance (for QR clock-in)
CREATE POLICY "Authenticated users can clock in for their org"
ON public.attendance
FOR INSERT
TO authenticated
WITH CHECK (is_same_organization(auth.uid(), organization_id));