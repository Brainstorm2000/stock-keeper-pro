CREATE OR REPLACE FUNCTION public.delete_purchase(_purchase_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  purchase_row public.purchases%ROWTYPE;
  purchase_item record;
  returned_quantity numeric;
  previous_stock numeric;
  net_quantity numeric;
  new_stock numeric;
BEGIN
  SELECT * INTO purchase_row
  FROM public.purchases
  WHERE id = _purchase_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Purchase not found';
  END IF;

  FOR purchase_item IN
    SELECT pi.product_id, pi.quantity
    FROM public.purchase_items pi
    WHERE pi.purchase_id = _purchase_id
  LOOP
    SELECT COALESCE(SUM(pri.quantity), 0)
    INTO returned_quantity
    FROM public.purchase_return_items pri
    JOIN public.purchase_returns pr ON pr.id = pri.return_id
    WHERE pr.purchase_id = _purchase_id
      AND pri.product_id = purchase_item.product_id;

    SELECT current_stock INTO previous_stock
    FROM public.products
    WHERE id = purchase_item.product_id
    FOR UPDATE;

    net_quantity := GREATEST(0, purchase_item.quantity - returned_quantity);
    new_stock := GREATEST(0, previous_stock - net_quantity);

    UPDATE public.products
    SET current_stock = new_stock
    WHERE id = purchase_item.product_id;

    INSERT INTO public.stock_history (
      product_id, previous_stock, new_stock, change_amount, change_type, notes, changed_by
    ) VALUES (
      purchase_item.product_id, previous_stock, new_stock, -net_quantity,
      'purchase_reversal', 'Deleted purchase ' || purchase_row.purchase_number,
      auth.uid()
    );
  END LOOP;

  DELETE FROM public.purchase_returns WHERE purchase_id = _purchase_id;
  DELETE FROM public.purchase_items WHERE purchase_id = _purchase_id;
  DELETE FROM public.purchases WHERE id = _purchase_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_purchase(uuid) TO authenticated;