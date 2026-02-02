-- Drop the constraint (not just the index)
ALTER TABLE public.units DROP CONSTRAINT IF EXISTS units_name_key;

-- Add unique constraint scoped to organization
CREATE UNIQUE INDEX units_name_org_key ON public.units (name, organization_id);