ALTER TABLE public.stock_history
  DROP CONSTRAINT IF EXISTS stock_history_change_type_check;

ALTER TABLE public.stock_history
  ADD CONSTRAINT stock_history_change_type_check
  CHECK (change_type = ANY (ARRAY[
    'increase'::text, 'decrease'::text, 'adjustment'::text, 'initial'::text,
    'purchase'::text, 'purchase_reversal'::text, 'sale'::text, 'sale_reversal'::text,
    'production'::text, 'manual_production'::text, 'damage'::text, 'damaged'::text,
    'sale_return'::text, 'purchase_return'::text
  ]));

CREATE OR REPLACE FUNCTION public.record_manual_production(
  _product_id uuid,
  _quantity numeric,
  _notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
  previous_stock numeric;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to record production.';
  END IF;

  IF _quantity IS NULL OR _quantity <= 0 THEN
    RAISE EXCEPTION 'Production quantity must be greater than zero.';
  END IF;

  UPDATE public.products
  SET current_stock = current_stock + _quantity
  WHERE id = _product_id
  RETURNING current_stock - _quantity INTO previous_stock;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found or you do not have permission to update its stock.';
  END IF;

  INSERT INTO public.stock_history (
    product_id, previous_stock, new_stock, change_amount, change_type, notes, changed_by
  )
  VALUES (
    _product_id,
    previous_stock,
    previous_stock + _quantity,
    _quantity,
    'manual_production',
    NULLIF(BTRIM(_notes), ''),
    auth.uid()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.record_manual_production(uuid, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_manual_production(uuid, numeric, text) TO authenticated;
