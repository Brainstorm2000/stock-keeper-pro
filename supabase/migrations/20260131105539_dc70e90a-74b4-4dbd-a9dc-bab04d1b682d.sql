-- Add organization_id column to products table
ALTER TABLE public.products 
ADD COLUMN organization_id uuid REFERENCES public.organizations(id);

-- Backfill existing products: get org from branch or from creator's profile
UPDATE public.products p
SET organization_id = COALESCE(
  (SELECT b.organization_id FROM public.branches b WHERE b.id = p.branch_id),
  (SELECT pr.organization_id FROM public.profiles pr WHERE pr.user_id = p.created_by)
);

-- Make organization_id NOT NULL after backfill
ALTER TABLE public.products 
ALTER COLUMN organization_id SET NOT NULL;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view products in their org branches" ON public.products;
DROP POLICY IF EXISTS "Admins can manage products in their branches" ON public.products;

-- Create new policies with organization check
CREATE POLICY "Users can view products in their org"
ON public.products
FOR SELECT
USING (
  is_same_organization(auth.uid(), organization_id) AND (
    is_super_admin(auth.uid()) OR 
    branch_id IS NULL OR 
    has_branch_access(auth.uid(), branch_id)
  )
);

CREATE POLICY "Admins can manage products in their org"
ON public.products
FOR ALL
USING (
  is_same_organization(auth.uid(), organization_id) AND (
    is_super_admin(auth.uid()) OR 
    (has_role(auth.uid(), 'admin'::app_role) AND (branch_id IS NULL OR has_branch_access(auth.uid(), branch_id)))
  )
)
WITH CHECK (
  is_same_organization(auth.uid(), organization_id) AND (
    is_super_admin(auth.uid()) OR 
    (has_role(auth.uid(), 'admin'::app_role) AND (branch_id IS NULL OR has_branch_access(auth.uid(), branch_id)))
  )
);