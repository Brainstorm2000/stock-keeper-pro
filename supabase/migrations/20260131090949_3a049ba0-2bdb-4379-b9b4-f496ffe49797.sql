-- Drop the existing restrictive INSERT policy
DROP POLICY IF EXISTS "Authenticated users can create organizations" ON public.organizations;

-- Create a permissive INSERT policy for organizations
CREATE POLICY "Authenticated users can create organizations"
ON public.organizations FOR INSERT
TO authenticated
WITH CHECK (true);

-- Also need to allow users to SELECT their newly created org
-- Update the SELECT policy to allow viewing org by ID during creation
DROP POLICY IF EXISTS "Users can view their own organization" ON public.organizations;

CREATE POLICY "Users can view organizations"
ON public.organizations FOR SELECT
TO authenticated
USING (true);

-- Note: Organizations are identified by slug which acts as invite code
-- Anyone can see org names/slugs to join, but data within orgs is protected by other tables' RLS