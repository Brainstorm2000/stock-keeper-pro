
-- 1. Add selling_price to purchase_items
ALTER TABLE public.purchase_items ADD COLUMN IF NOT EXISTS selling_price numeric NOT NULL DEFAULT 0;

-- 2. Create action_task_staff junction table for multi-staff assignment
CREATE TABLE public.action_task_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.action_tasks(id) ON DELETE CASCADE,
  staff_id uuid NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(task_id, staff_id)
);

ALTER TABLE public.action_task_staff ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view task staff in their org" ON public.action_task_staff
  FOR SELECT TO public
  USING (EXISTS (
    SELECT 1 FROM public.action_tasks at WHERE at.id = action_task_staff.task_id
    AND is_same_organization(auth.uid(), at.organization_id)
  ));

CREATE POLICY "Admins can manage task staff" ON public.action_task_staff
  FOR ALL TO public
  USING (EXISTS (
    SELECT 1 FROM public.action_tasks at WHERE at.id = action_task_staff.task_id
    AND is_same_organization(auth.uid(), at.organization_id)
    AND (is_super_admin(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.action_tasks at WHERE at.id = action_task_staff.task_id
    AND is_same_organization(auth.uid(), at.organization_id)
    AND (is_super_admin(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))
  ));

-- 3. Create purchase_returns table
CREATE TABLE public.purchase_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  purchase_id uuid NOT NULL REFERENCES public.purchases(id),
  branch_id uuid NOT NULL REFERENCES public.branches(id),
  return_number text NOT NULL,
  return_date date NOT NULL DEFAULT CURRENT_DATE,
  total_amount numeric NOT NULL DEFAULT 0,
  reason text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.purchase_returns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage purchase returns" ON public.purchase_returns
  FOR ALL TO public
  USING (is_same_organization(auth.uid(), organization_id) AND (is_super_admin(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role)))
  WITH CHECK (is_same_organization(auth.uid(), organization_id) AND (is_super_admin(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role)));

CREATE POLICY "Users can view purchase returns in their org" ON public.purchase_returns
  FOR SELECT TO public
  USING (is_same_organization(auth.uid(), organization_id));

CREATE POLICY "Subscription required for purchase return writes" ON public.purchase_returns
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (has_active_subscription(auth.uid()));

-- Create purchase_return_items table
CREATE TABLE public.purchase_return_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id uuid NOT NULL REFERENCES public.purchase_returns(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id),
  quantity numeric NOT NULL,
  unit_cost numeric NOT NULL DEFAULT 0,
  total_cost numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.purchase_return_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage purchase return items" ON public.purchase_return_items
  FOR ALL TO public
  USING (EXISTS (
    SELECT 1 FROM public.purchase_returns pr WHERE pr.id = purchase_return_items.return_id
    AND is_same_organization(auth.uid(), pr.organization_id)
    AND (is_super_admin(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.purchase_returns pr WHERE pr.id = purchase_return_items.return_id
    AND is_same_organization(auth.uid(), pr.organization_id)
    AND (is_super_admin(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))
  ));

CREATE POLICY "Users can view purchase return items" ON public.purchase_return_items
  FOR SELECT TO public
  USING (EXISTS (
    SELECT 1 FROM public.purchase_returns pr WHERE pr.id = purchase_return_items.return_id
    AND is_same_organization(auth.uid(), pr.organization_id)
  ));

-- 4. Create sale_returns table
CREATE TABLE public.sale_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  sale_id uuid NOT NULL REFERENCES public.sales(id),
  branch_id uuid REFERENCES public.branches(id),
  return_number text NOT NULL,
  return_date date NOT NULL DEFAULT CURRENT_DATE,
  total_amount numeric NOT NULL DEFAULT 0,
  refund_method text NOT NULL DEFAULT 'cash',
  reason text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sale_returns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage sale returns" ON public.sale_returns
  FOR ALL TO public
  USING (is_same_organization(auth.uid(), organization_id) AND (is_super_admin(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role)))
  WITH CHECK (is_same_organization(auth.uid(), organization_id) AND (is_super_admin(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role)));

CREATE POLICY "Users can view sale returns in their org" ON public.sale_returns
  FOR SELECT TO public
  USING (is_same_organization(auth.uid(), organization_id));

CREATE POLICY "Subscription required for sale return writes" ON public.sale_returns
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (has_active_subscription(auth.uid()));

-- Create sale_return_items table
CREATE TABLE public.sale_return_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id uuid NOT NULL REFERENCES public.sale_returns(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id),
  quantity numeric NOT NULL,
  unit_price numeric NOT NULL DEFAULT 0,
  total_price numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sale_return_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage sale return items" ON public.sale_return_items
  FOR ALL TO public
  USING (EXISTS (
    SELECT 1 FROM public.sale_returns sr WHERE sr.id = sale_return_items.return_id
    AND is_same_organization(auth.uid(), sr.organization_id)
    AND (is_super_admin(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.sale_returns sr WHERE sr.id = sale_return_items.return_id
    AND is_same_organization(auth.uid(), sr.organization_id)
    AND (is_super_admin(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))
  ));

CREATE POLICY "Users can view sale return items" ON public.sale_return_items
  FOR SELECT TO public
  USING (EXISTS (
    SELECT 1 FROM public.sale_returns sr WHERE sr.id = sale_return_items.return_id
    AND is_same_organization(auth.uid(), sr.organization_id)
  ));

-- Generate return numbers
CREATE OR REPLACE FUNCTION public.generate_purchase_return_number(org_id uuid)
RETURNS text LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE next_num integer;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(return_number FROM 4) AS integer)), 0) + 1
  INTO next_num FROM public.purchase_returns WHERE organization_id = org_id;
  RETURN 'PR-' || LPAD(next_num::text, 5, '0');
END;
$$;

CREATE OR REPLACE FUNCTION public.generate_sale_return_number(org_id uuid)
RETURNS text LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE next_num integer;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(return_number FROM 4) AS integer)), 0) + 1
  INTO next_num FROM public.sale_returns WHERE organization_id = org_id;
  RETURN 'SR-' || LPAD(next_num::text, 5, '0');
END;
$$;
