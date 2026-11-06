CREATE OR REPLACE FUNCTION public.update_manual_production(
  _history_id uuid,
  _quantity numeric,
  _notes text DEFAULT NULL,
  _expiration_date date DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  history_row public.stock_history%ROWTYPE;
  product_row public.products%ROWTYPE;
  batch_row public.inventory_batches%ROWTYPE;
  quantity_delta numeric;
  next_stock numeric;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to edit production.';
  END IF;
  IF _quantity IS NULL OR _quantity <= 0 THEN
    RAISE EXCEPTION 'Production quantity must be greater than zero.';
  END IF;

  SELECT * INTO history_row
  FROM public.stock_history
  WHERE id = _history_id AND change_type = 'manual_production'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quick-production record not found.';
  END IF;

  SELECT * INTO product_row
  FROM public.products
  WHERE id = history_row.product_id
  FOR UPDATE;
  IF NOT FOUND OR product_row.item_type <> 'product' THEN
    RAISE EXCEPTION 'Stock-managed product not found.';
  END IF;

  SELECT * INTO batch_row
  FROM public.inventory_batches
  WHERE source_id = history_row.id
    AND source_type = 'manual_production'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This production record cannot be edited because its batch was deleted or reversed.';
  END IF;

  quantity_delta := _quantity - batch_row.initial_quantity;
  IF quantity_delta < 0 AND (
    batch_row.remaining_quantity < abs(quantity_delta)
    OR product_row.current_stock < abs(quantity_delta)
  ) THEN
    RAISE EXCEPTION 'The produced stock has already been used. This edit would make inventory negative.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.inventory_batch_movements
    WHERE batch_id = batch_row.id
      AND source_type = 'manual_production'
      AND source_id = history_row.id
      AND direction = 'in'
  ) THEN
    INSERT INTO public.inventory_batch_movements (
      batch_id, direction, quantity, source_type, source_id, created_by
    )
    VALUES (
      batch_row.id, 'in', batch_row.initial_quantity,
      'manual_production', history_row.id, auth.uid()
    );
  END IF;

  next_stock := product_row.current_stock + quantity_delta;
  UPDATE public.products
  SET current_stock = next_stock
  WHERE id = product_row.id;

  UPDATE public.inventory_batches
  SET initial_quantity = _quantity,
      remaining_quantity = remaining_quantity + quantity_delta,
      expiration_date = _expiration_date
  WHERE id = batch_row.id;

  IF quantity_delta <> 0 THEN
    INSERT INTO public.inventory_batch_movements (
      batch_id, direction, quantity, source_type, source_id, created_by
    )
    VALUES (
      batch_row.id,
      CASE WHEN quantity_delta > 0 THEN 'in' ELSE 'out' END,
      abs(quantity_delta),
      'manual_production_adjustment',
      history_row.id,
      auth.uid()
    );

    INSERT INTO public.stock_history (
      product_id, previous_stock, new_stock, change_amount,
      change_type, notes, changed_by
    )
    VALUES (
      product_row.id,
      product_row.current_stock,
      next_stock,
      quantity_delta,
      'adjustment',
      'Quick production ' || history_row.id::text || ' adjusted from ' ||
        batch_row.initial_quantity::text || ' to ' || _quantity::text ||
        CASE WHEN NULLIF(BTRIM(_notes), '') IS NULL
          THEN ''
          ELSE '. ' || NULLIF(BTRIM(_notes), '')
        END,
      auth.uid()
    );
  END IF;

  UPDATE public.stock_history
  SET notes = NULLIF(BTRIM(_notes), '')
  WHERE id = history_row.id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_manual_production(uuid, numeric, text, date)
TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_manual_production(_history_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  history_row public.stock_history%ROWTYPE;
  product_row public.products%ROWTYPE;
  batch_row public.inventory_batches%ROWTYPE;
  next_stock numeric;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to delete production.';
  END IF;

  SELECT * INTO history_row
  FROM public.stock_history
  WHERE id = _history_id AND change_type = 'manual_production'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Quick-production record not found.';
  END IF;

  SELECT * INTO product_row
  FROM public.products
  WHERE id = history_row.product_id
  FOR UPDATE;
  IF NOT FOUND OR product_row.item_type <> 'product' THEN
    RAISE EXCEPTION 'Stock-managed product not found.';
  END IF;

  SELECT * INTO batch_row
  FROM public.inventory_batches
  WHERE source_id = history_row.id
    AND source_type = 'manual_production'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This production record has already been reversed or its batch was deleted.';
  END IF;

  IF batch_row.remaining_quantity < batch_row.initial_quantity
    OR product_row.current_stock < batch_row.initial_quantity THEN
    RAISE EXCEPTION 'Produced stock has already been used. This record cannot be deleted without making inventory negative.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.inventory_batch_movements
    WHERE batch_id = batch_row.id
      AND source_type = 'manual_production'
      AND source_id = history_row.id
      AND direction = 'in'
  ) THEN
    INSERT INTO public.inventory_batch_movements (
      batch_id, direction, quantity, source_type, source_id, created_by
    )
    VALUES (
      batch_row.id, 'in', batch_row.initial_quantity,
      'manual_production', history_row.id, auth.uid()
    );
  END IF;

  next_stock := product_row.current_stock - batch_row.initial_quantity;
  UPDATE public.products
  SET current_stock = next_stock
  WHERE id = product_row.id;

  UPDATE public.inventory_batches
  SET remaining_quantity = 0,
      source_type = 'manual_production_deleted'
  WHERE id = batch_row.id;

  INSERT INTO public.inventory_batch_movements (
    batch_id, direction, quantity, source_type, source_id, created_by
  )
  VALUES (
    batch_row.id, 'out', batch_row.initial_quantity,
    'manual_production_reversal', history_row.id, auth.uid()
  );

  INSERT INTO public.stock_history (
    product_id, previous_stock, new_stock, change_amount,
    change_type, notes, changed_by
  )
  VALUES (
    product_row.id,
    product_row.current_stock,
    next_stock,
    -batch_row.initial_quantity,
    'adjustment',
    'Quick production ' || history_row.id::text || ' reversed',
    auth.uid()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_manual_production(uuid)
TO authenticated;
