
-- 1. Extend item_type enum
ALTER TYPE public.item_type ADD VALUE IF NOT EXISTS 'variable';

-- 2. product_attributes
CREATE TABLE public.product_attributes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX product_attributes_org_name_idx ON public.product_attributes (organization_id, lower(name));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_attributes TO authenticated;
GRANT ALL ON public.product_attributes TO service_role;
ALTER TABLE public.product_attributes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view attributes in their org" ON public.product_attributes
  FOR SELECT USING (public.is_same_organization(auth.uid(), organization_id) OR public.is_super_super_admin(auth.uid()));
CREATE POLICY "Admins manage attributes in their org" ON public.product_attributes
  FOR ALL USING (public.is_same_organization(auth.uid(), organization_id)
                 AND (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role)))
        WITH CHECK (public.is_same_organization(auth.uid(), organization_id)
                 AND (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role)));
CREATE POLICY "Subscription required for attribute writes" ON public.product_attributes
  AS RESTRICTIVE TO authenticated
  USING (public.has_active_subscription(auth.uid()))
  WITH CHECK (public.has_active_subscription(auth.uid()));
CREATE TRIGGER update_product_attributes_updated_at BEFORE UPDATE ON public.product_attributes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. product_attribute_values
CREATE TABLE public.product_attribute_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attribute_id uuid NOT NULL REFERENCES public.product_attributes(id) ON DELETE CASCADE,
  value text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX pav_attr_value_idx ON public.product_attribute_values (attribute_id, lower(value));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_attribute_values TO authenticated;
GRANT ALL ON public.product_attribute_values TO service_role;
ALTER TABLE public.product_attribute_values ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view attribute values in their org" ON public.product_attribute_values
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.product_attributes a
    WHERE a.id = attribute_id
      AND (public.is_same_organization(auth.uid(), a.organization_id) OR public.is_super_super_admin(auth.uid()))
  ));
CREATE POLICY "Admins manage attribute values" ON public.product_attribute_values
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.product_attributes a
    WHERE a.id = attribute_id
      AND public.is_same_organization(auth.uid(), a.organization_id)
      AND (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role))
  )) WITH CHECK (EXISTS (
    SELECT 1 FROM public.product_attributes a
    WHERE a.id = attribute_id
      AND public.is_same_organization(auth.uid(), a.organization_id)
      AND (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role))
  ));
CREATE POLICY "Subscription required for attribute value writes" ON public.product_attribute_values
  AS RESTRICTIVE TO authenticated
  USING (public.has_active_subscription(auth.uid()))
  WITH CHECK (public.has_active_subscription(auth.uid()));

-- 4. product_variations
CREATE TABLE public.product_variations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  sku text,
  opening_stock numeric(15,2) NOT NULL DEFAULT 0,
  current_stock numeric(15,2) NOT NULL DEFAULT 0,
  low_stock_threshold numeric(15,2) NOT NULL DEFAULT 10,
  out_of_stock_threshold numeric(15,2) NOT NULL DEFAULT 0,
  cost_price numeric NOT NULL DEFAULT 0,
  selling_price numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX product_variations_product_idx ON public.product_variations(product_id);
CREATE UNIQUE INDEX product_variations_org_sku_idx
  ON public.product_variations(organization_id, lower(sku)) WHERE sku IS NOT NULL;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_variations TO authenticated;
GRANT ALL ON public.product_variations TO service_role;
ALTER TABLE public.product_variations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view variations in their org" ON public.product_variations
  FOR SELECT USING (public.is_same_organization(auth.uid(), organization_id) OR public.is_super_super_admin(auth.uid()));
CREATE POLICY "Admins manage variations in their org" ON public.product_variations
  FOR ALL USING (public.is_same_organization(auth.uid(), organization_id)
                 AND (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role)))
        WITH CHECK (public.is_same_organization(auth.uid(), organization_id)
                 AND (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role)));
CREATE POLICY "Subscription required for variation writes" ON public.product_variations
  AS RESTRICTIVE TO authenticated
  USING (public.has_active_subscription(auth.uid()))
  WITH CHECK (public.has_active_subscription(auth.uid()));
CREATE TRIGGER update_product_variations_updated_at BEFORE UPDATE ON public.product_variations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. product_variation_attributes (link)
CREATE TABLE public.product_variation_attributes (
  variation_id uuid NOT NULL REFERENCES public.product_variations(id) ON DELETE CASCADE,
  attribute_id uuid NOT NULL REFERENCES public.product_attributes(id) ON DELETE RESTRICT,
  value_id uuid NOT NULL REFERENCES public.product_attribute_values(id) ON DELETE RESTRICT,
  PRIMARY KEY (variation_id, attribute_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_variation_attributes TO authenticated;
GRANT ALL ON public.product_variation_attributes TO service_role;
ALTER TABLE public.product_variation_attributes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view variation attribute links in their org" ON public.product_variation_attributes
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.product_variations v
    WHERE v.id = variation_id
      AND (public.is_same_organization(auth.uid(), v.organization_id) OR public.is_super_super_admin(auth.uid()))
  ));
CREATE POLICY "Admins manage variation attribute links" ON public.product_variation_attributes
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.product_variations v
    WHERE v.id = variation_id
      AND public.is_same_organization(auth.uid(), v.organization_id)
      AND (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role))
  )) WITH CHECK (EXISTS (
    SELECT 1 FROM public.product_variations v
    WHERE v.id = variation_id
      AND public.is_same_organization(auth.uid(), v.organization_id)
      AND (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role))
  ));

-- 6. Add variation_id columns to transactional tables
ALTER TABLE public.sale_items
  ADD COLUMN IF NOT EXISTS variation_id uuid REFERENCES public.product_variations(id);
ALTER TABLE public.purchase_items
  ADD COLUMN IF NOT EXISTS variation_id uuid REFERENCES public.product_variations(id);
ALTER TABLE public.sale_return_items
  ADD COLUMN IF NOT EXISTS variation_id uuid REFERENCES public.product_variations(id);
ALTER TABLE public.purchase_return_items
  ADD COLUMN IF NOT EXISTS variation_id uuid REFERENCES public.product_variations(id);
ALTER TABLE public.stock_history
  ADD COLUMN IF NOT EXISTS variation_id uuid REFERENCES public.product_variations(id) ON DELETE CASCADE;

-- 7. Audit actor trigger: cover product_variations & product_attributes
CREATE OR REPLACE FUNCTION public.set_audit_actor_from_auth()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  IF TG_TABLE_NAME = 'stock_history' THEN
    IF NEW.changed_by IS NULL THEN
      NEW.changed_by := auth.uid();
    END IF;
  ELSIF TG_TABLE_NAME = 'raw_material_stock_history' THEN
    IF NEW.changed_by IS NULL THEN
      NEW.changed_by := auth.uid();
    END IF;
  ELSIF TG_TABLE_NAME = 'work_orders' THEN
    IF NEW.created_by IS NULL THEN
      NEW.created_by := auth.uid();
    END IF;
  ELSIF TG_TABLE_NAME IN ('product_variations', 'product_attributes') THEN
    IF NEW.created_by IS NULL THEN
      NEW.created_by := auth.uid();
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_set_audit_actor_variations
  BEFORE INSERT ON public.product_variations
  FOR EACH ROW EXECUTE FUNCTION public.set_audit_actor_from_auth();
CREATE TRIGGER trg_set_audit_actor_attributes
  BEFORE INSERT ON public.product_attributes
  FOR EACH ROW EXECUTE FUNCTION public.set_audit_actor_from_auth();

-- 8. Parent stock recompute trigger for variable products
CREATE OR REPLACE FUNCTION public.recompute_variable_product_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  pid uuid;
BEGIN
  pid := COALESCE(NEW.product_id, OLD.product_id);
  IF pid IS NULL THEN RETURN NULL; END IF;
  UPDATE public.products
     SET current_stock = COALESCE(
       (SELECT SUM(current_stock) FROM public.product_variations WHERE product_id = pid),
       0)
   WHERE id = pid
     AND item_type::text = 'variable';
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_recompute_variable_stock_iud
  AFTER INSERT OR UPDATE OR DELETE ON public.product_variations
  FOR EACH ROW EXECUTE FUNCTION public.recompute_variable_product_stock();
