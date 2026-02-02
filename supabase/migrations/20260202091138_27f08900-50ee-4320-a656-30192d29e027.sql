-- Create payment status enum for purchases
CREATE TYPE public.purchase_payment_status AS ENUM ('pending', 'partial', 'paid');

-- Create purchases table
CREATE TABLE public.purchases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  supplier_id UUID NOT NULL REFERENCES public.suppliers(id) ON DELETE RESTRICT,
  purchase_number TEXT NOT NULL,
  purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,
  reference_number TEXT,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  total_amount NUMERIC NOT NULL DEFAULT 0,
  payment_status public.purchase_payment_status NOT NULL DEFAULT 'pending',
  amount_paid NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create purchase_items table
CREATE TABLE public.purchase_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  purchase_id UUID NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  quantity NUMERIC NOT NULL,
  unit_cost NUMERIC NOT NULL,
  total_cost NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;

-- RLS policies for purchases
CREATE POLICY "Users can view purchases in their org"
ON public.purchases
FOR SELECT
USING (
  is_same_organization(auth.uid(), organization_id) AND
  (is_super_admin(auth.uid()) OR has_branch_access(auth.uid(), branch_id))
);

CREATE POLICY "Admins can manage purchases"
ON public.purchases
FOR ALL
USING (
  is_same_organization(auth.uid(), organization_id) AND
  (is_super_admin(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))
)
WITH CHECK (
  is_same_organization(auth.uid(), organization_id) AND
  (is_super_admin(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))
);

-- RLS policies for purchase_items
CREATE POLICY "Users can view purchase items for accessible purchases"
ON public.purchase_items
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM purchases p
    WHERE p.id = purchase_items.purchase_id
    AND is_same_organization(auth.uid(), p.organization_id)
    AND (is_super_admin(auth.uid()) OR has_branch_access(auth.uid(), p.branch_id))
  )
);

CREATE POLICY "Admins can manage purchase items"
ON public.purchase_items
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM purchases p
    WHERE p.id = purchase_items.purchase_id
    AND is_same_organization(auth.uid(), p.organization_id)
    AND (is_super_admin(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM purchases p
    WHERE p.id = purchase_items.purchase_id
    AND is_same_organization(auth.uid(), p.organization_id)
    AND (is_super_admin(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))
  )
);

-- Create function to generate purchase number
CREATE OR REPLACE FUNCTION public.generate_purchase_number(org_id uuid)
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  next_num integer;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(purchase_number FROM 4) AS integer)), 0) + 1
  INTO next_num
  FROM public.purchases
  WHERE organization_id = org_id;
  
  RETURN 'PO-' || LPAD(next_num::text, 5, '0');
END;
$$;

-- Add trigger for updated_at
CREATE TRIGGER update_purchases_updated_at
  BEFORE UPDATE ON public.purchases
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();