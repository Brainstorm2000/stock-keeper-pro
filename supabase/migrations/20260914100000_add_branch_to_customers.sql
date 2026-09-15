ALTER TABLE public.customers
ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;

CREATE INDEX customers_branch_id_idx ON public.customers(branch_id);

-- Preserve existing customers and assign them automatically where the organization
-- has exactly one branch.
UPDATE public.customers c
SET branch_id = b.id
FROM public.branches b
WHERE c.organization_id = b.organization_id
  AND (
    SELECT COUNT(*)
    FROM public.branches b2
    WHERE b2.organization_id = c.organization_id
  ) = 1;

DROP POLICY "Users can view customers in their org" ON public.customers;
CREATE POLICY "Users can view customers in their org"
ON public.customers FOR SELECT
USING (
  is_same_organization(auth.uid(), organization_id)
  AND (is_super_admin(auth.uid()) OR branch_id IS NULL OR has_branch_access(auth.uid(), branch_id))
);