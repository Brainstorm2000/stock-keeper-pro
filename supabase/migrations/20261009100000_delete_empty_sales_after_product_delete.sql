ALTER TABLE public.sale_returns
  DROP CONSTRAINT IF EXISTS sale_returns_sale_id_fkey,
  ADD CONSTRAINT sale_returns_sale_id_fkey
    FOREIGN KEY (sale_id) REFERENCES public.sales(id) ON DELETE CASCADE;

ALTER TABLE public.debt_payments
  DROP CONSTRAINT IF EXISTS debt_payments_sale_id_fkey,
  ADD CONSTRAINT debt_payments_sale_id_fkey
    FOREIGN KEY (sale_id) REFERENCES public.sales(id) ON DELETE CASCADE;

CREATE OR REPLACE FUNCTION public.delete_sales_without_remaining_products()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.sales s
  USING public.sale_items target_item
  WHERE target_item.product_id = OLD.id
    AND target_item.sale_id = s.id
    AND NOT EXISTS (
      SELECT 1
      FROM public.sale_items other_item
      WHERE other_item.sale_id = s.id
        AND other_item.product_id <> OLD.id
    );

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS delete_sales_without_remaining_products_before_product_delete ON public.products;
CREATE TRIGGER delete_sales_without_remaining_products_before_product_delete
  BEFORE DELETE ON public.products
  FOR EACH ROW
  EXECUTE FUNCTION public.delete_sales_without_remaining_products();
