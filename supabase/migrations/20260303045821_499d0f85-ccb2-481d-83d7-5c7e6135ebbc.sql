
-- Raw Materials table
CREATE TABLE public.raw_materials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  name TEXT NOT NULL,
  unit_id UUID NOT NULL REFERENCES public.units(id),
  cost_per_unit NUMERIC NOT NULL DEFAULT 0,
  current_stock NUMERIC NOT NULL DEFAULT 0,
  low_stock_threshold NUMERIC NOT NULL DEFAULT 10,
  sku TEXT,
  description TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.raw_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage raw materials"
ON public.raw_materials FOR ALL
USING (is_same_organization(auth.uid(), organization_id) AND (is_super_admin(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role)))
WITH CHECK (is_same_organization(auth.uid(), organization_id) AND (is_super_admin(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role)));

CREATE POLICY "Users can view raw materials in their org"
ON public.raw_materials FOR SELECT
USING (is_same_organization(auth.uid(), organization_id));

CREATE TRIGGER update_raw_materials_updated_at
BEFORE UPDATE ON public.raw_materials
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Raw Material Stock History
CREATE TABLE public.raw_material_stock_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  raw_material_id UUID NOT NULL REFERENCES public.raw_materials(id) ON DELETE CASCADE,
  previous_stock NUMERIC NOT NULL,
  new_stock NUMERIC NOT NULL,
  change_amount NUMERIC NOT NULL,
  change_type TEXT NOT NULL,
  reference_type TEXT,
  reference_id UUID,
  notes TEXT,
  changed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.raw_material_stock_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can insert raw material stock history"
ON public.raw_material_stock_history FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM raw_materials rm
  WHERE rm.id = raw_material_stock_history.raw_material_id
  AND is_same_organization(auth.uid(), rm.organization_id)
  AND (is_super_admin(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))
));

CREATE POLICY "Users can view raw material stock history"
ON public.raw_material_stock_history FOR SELECT
USING (EXISTS (
  SELECT 1 FROM raw_materials rm
  WHERE rm.id = raw_material_stock_history.raw_material_id
  AND is_same_organization(auth.uid(), rm.organization_id)
));

-- Bill of Materials
CREATE TABLE public.bill_of_materials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  product_id UUID NOT NULL REFERENCES public.products(id),
  name TEXT NOT NULL,
  description TEXT,
  labor_cost_per_unit NUMERIC NOT NULL DEFAULT 0,
  overhead_cost_per_unit NUMERIC NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bill_of_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage BOMs"
ON public.bill_of_materials FOR ALL
USING (is_same_organization(auth.uid(), organization_id) AND (is_super_admin(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role)))
WITH CHECK (is_same_organization(auth.uid(), organization_id) AND (is_super_admin(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role)));

CREATE POLICY "Users can view BOMs in their org"
ON public.bill_of_materials FOR SELECT
USING (is_same_organization(auth.uid(), organization_id));

CREATE TRIGGER update_bom_updated_at
BEFORE UPDATE ON public.bill_of_materials
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- BOM Items
CREATE TABLE public.bom_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  bom_id UUID NOT NULL REFERENCES public.bill_of_materials(id) ON DELETE CASCADE,
  raw_material_id UUID NOT NULL REFERENCES public.raw_materials(id),
  quantity_required NUMERIC NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bom_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage BOM items"
ON public.bom_items FOR ALL
USING (EXISTS (
  SELECT 1 FROM bill_of_materials bom
  WHERE bom.id = bom_items.bom_id
  AND is_same_organization(auth.uid(), bom.organization_id)
  AND (is_super_admin(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))
))
WITH CHECK (EXISTS (
  SELECT 1 FROM bill_of_materials bom
  WHERE bom.id = bom_items.bom_id
  AND is_same_organization(auth.uid(), bom.organization_id)
  AND (is_super_admin(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))
));

CREATE POLICY "Users can view BOM items in their org"
ON public.bom_items FOR SELECT
USING (EXISTS (
  SELECT 1 FROM bill_of_materials bom
  WHERE bom.id = bom_items.bom_id
  AND is_same_organization(auth.uid(), bom.organization_id)
));

-- Work Orders
CREATE TABLE public.work_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  work_order_number TEXT NOT NULL,
  product_id UUID NOT NULL REFERENCES public.products(id),
  bom_id UUID NOT NULL REFERENCES public.bill_of_materials(id),
  quantity NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  labor_cost NUMERIC NOT NULL DEFAULT 0,
  overhead_cost NUMERIC NOT NULL DEFAULT 0,
  material_cost NUMERIC NOT NULL DEFAULT 0,
  total_cost NUMERIC NOT NULL DEFAULT 0,
  cost_per_unit NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  approved_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage work orders"
ON public.work_orders FOR ALL
USING (is_same_organization(auth.uid(), organization_id) AND (is_super_admin(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role)))
WITH CHECK (is_same_organization(auth.uid(), organization_id) AND (is_super_admin(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role)));

CREATE POLICY "Users can view work orders in their org"
ON public.work_orders FOR SELECT
USING (is_same_organization(auth.uid(), organization_id));

CREATE TRIGGER update_work_orders_updated_at
BEFORE UPDATE ON public.work_orders
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Work Order Materials
CREATE TABLE public.work_order_materials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  work_order_id UUID NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  raw_material_id UUID NOT NULL REFERENCES public.raw_materials(id),
  quantity_required NUMERIC NOT NULL,
  quantity_used NUMERIC NOT NULL DEFAULT 0,
  unit_cost NUMERIC NOT NULL DEFAULT 0,
  total_cost NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.work_order_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage work order materials"
ON public.work_order_materials FOR ALL
USING (EXISTS (
  SELECT 1 FROM work_orders wo
  WHERE wo.id = work_order_materials.work_order_id
  AND is_same_organization(auth.uid(), wo.organization_id)
  AND (is_super_admin(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))
))
WITH CHECK (EXISTS (
  SELECT 1 FROM work_orders wo
  WHERE wo.id = work_order_materials.work_order_id
  AND is_same_organization(auth.uid(), wo.organization_id)
  AND (is_super_admin(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))
));

CREATE POLICY "Users can view work order materials in their org"
ON public.work_order_materials FOR SELECT
USING (EXISTS (
  SELECT 1 FROM work_orders wo
  WHERE wo.id = work_order_materials.work_order_id
  AND is_same_organization(auth.uid(), wo.organization_id)
));

-- Function to generate work order numbers
CREATE OR REPLACE FUNCTION public.generate_work_order_number(org_id uuid)
RETURNS text
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  next_num integer;
BEGIN
  SELECT COALESCE(MAX(CAST(SUBSTRING(work_order_number FROM 4) AS integer)), 0) + 1
  INTO next_num
  FROM public.work_orders
  WHERE organization_id = org_id;
  
  RETURN 'WO-' || LPAD(next_num::text, 5, '0');
END;
$$;
