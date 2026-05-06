-- Price history table
CREATE TABLE public.product_price_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL,
  organization_id UUID NOT NULL,
  previous_cost_price NUMERIC NOT NULL DEFAULT 0,
  new_cost_price NUMERIC NOT NULL DEFAULT 0,
  previous_selling_price NUMERIC NOT NULL DEFAULT 0,
  new_selling_price NUMERIC NOT NULL DEFAULT 0,
  change_type TEXT NOT NULL DEFAULT 'update',
  notes TEXT,
  changed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_product_price_history_product ON public.product_price_history(product_id, created_at DESC);
CREATE INDEX idx_product_price_history_org ON public.product_price_history(organization_id, created_at DESC);

ALTER TABLE public.product_price_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view price history in their org"
ON public.product_price_history FOR SELECT
USING (is_same_organization(auth.uid(), organization_id));

CREATE POLICY "Admins can manage price history"
ON public.product_price_history FOR ALL
USING (is_same_organization(auth.uid(), organization_id) AND (is_super_admin(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role)))
WITH CHECK (is_same_organization(auth.uid(), organization_id) AND (is_super_admin(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role)));

-- Trigger function: log on insert and on price change
CREATE OR REPLACE FUNCTION public.log_product_price_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.cost_price, 0) <> 0 OR COALESCE(NEW.selling_price, 0) <> 0 THEN
      INSERT INTO public.product_price_history (
        product_id, organization_id,
        previous_cost_price, new_cost_price,
        previous_selling_price, new_selling_price,
        change_type, changed_by, notes
      ) VALUES (
        NEW.id, NEW.organization_id,
        0, COALESCE(NEW.cost_price, 0),
        0, COALESCE(NEW.selling_price, 0),
        'initial', NEW.created_by, 'Initial price'
      );
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF COALESCE(NEW.cost_price, 0) <> COALESCE(OLD.cost_price, 0)
       OR COALESCE(NEW.selling_price, 0) <> COALESCE(OLD.selling_price, 0) THEN
      INSERT INTO public.product_price_history (
        product_id, organization_id,
        previous_cost_price, new_cost_price,
        previous_selling_price, new_selling_price,
        change_type, changed_by
      ) VALUES (
        NEW.id, NEW.organization_id,
        COALESCE(OLD.cost_price, 0), COALESCE(NEW.cost_price, 0),
        COALESCE(OLD.selling_price, 0), COALESCE(NEW.selling_price, 0),
        'update', auth.uid()
      );
    END IF;
    RETURN NEW;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_product_price_change
AFTER INSERT OR UPDATE OF cost_price, selling_price ON public.products
FOR EACH ROW EXECUTE FUNCTION public.log_product_price_change();