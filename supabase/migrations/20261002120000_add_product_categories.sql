CREATE TABLE public.product_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(trim(name)) > 0),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX product_categories_org_name_idx
  ON public.product_categories (organization_id, lower(name));

CREATE INDEX product_categories_org_idx
  ON public.product_categories (organization_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_categories TO authenticated;
GRANT ALL ON public.product_categories TO service_role;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view product categories in their org"
  ON public.product_categories
  FOR SELECT
  USING (public.is_same_organization(auth.uid(), organization_id) OR public.is_super_super_admin(auth.uid()));

CREATE POLICY "Admins manage product categories in their org"
  ON public.product_categories
  FOR ALL
  USING (
    public.is_same_organization(auth.uid(), organization_id)
    AND (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role))
  )
  WITH CHECK (
    public.is_same_organization(auth.uid(), organization_id)
    AND (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role))
  );

CREATE POLICY "Subscription required for product category writes"
  ON public.product_categories
  AS RESTRICTIVE
  FOR ALL TO authenticated
  USING (public.has_active_subscription(auth.uid()))
  WITH CHECK (public.has_active_subscription(auth.uid()));

CREATE TRIGGER update_product_categories_updated_at
  BEFORE UPDATE ON public.product_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.products
  ADD COLUMN product_category_id uuid REFERENCES public.product_categories(id) ON DELETE SET NULL;

INSERT INTO public.product_categories (organization_id, name)
SELECT id, 'Uncategorized'
FROM public.organizations
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.create_default_product_category_for_org()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.product_categories (organization_id, name)
  VALUES (NEW.id, 'Uncategorized')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER create_default_product_category_after_org_insert
  AFTER INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.create_default_product_category_for_org();

UPDATE public.products AS product
SET product_category_id = category.id
FROM public.product_categories AS category
WHERE category.organization_id = product.organization_id
  AND lower(category.name) = 'uncategorized'
  AND product.product_category_id IS NULL;

CREATE OR REPLACE FUNCTION public.assign_default_product_category()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.product_category_id IS NULL THEN
    SELECT id
      INTO NEW.product_category_id
      FROM public.product_categories
     WHERE organization_id = NEW.organization_id
       AND lower(name) = 'uncategorized'
     LIMIT 1;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER assign_default_product_category_before_write
  BEFORE INSERT OR UPDATE OF organization_id, product_category_id ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.assign_default_product_category();