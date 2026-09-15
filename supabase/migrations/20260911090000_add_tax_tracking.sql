ALTER TABLE public.expenses
ADD COLUMN is_tax_allowable boolean NOT NULL DEFAULT true;

CREATE TABLE public.tax_wht_credits (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  credit_date date NOT NULL DEFAULT CURRENT_DATE,
  payer_name text NOT NULL,
  reference text,
  amount numeric NOT NULL CHECK (amount >= 0),
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.tax_wht_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view WHT credits in their org"
ON public.tax_wht_credits FOR SELECT
USING (is_same_organization(auth.uid(), organization_id));

CREATE POLICY "Admins can manage WHT credits"
ON public.tax_wht_credits FOR ALL
USING (is_same_organization(auth.uid(), organization_id) AND (is_super_admin(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role)))
WITH CHECK (is_same_organization(auth.uid(), organization_id) AND (is_super_admin(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role)));

CREATE INDEX tax_wht_credits_org_date_idx
ON public.tax_wht_credits (organization_id, credit_date);