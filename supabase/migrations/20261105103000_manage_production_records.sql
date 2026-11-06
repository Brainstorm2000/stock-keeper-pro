CREATE OR REPLACE FUNCTION public.record_manual_production(
  _product_id uuid,
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
  previous_stock numeric;
  history_id uuid;
  batch_id uuid;
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
    product_id, previous_stock, new_stock, change_amount,
    change_type, notes, changed_by
  )
  VALUES (
    _product_id, previous_stock, previous_stock + _quantity, _quantity,
    'manual_production', NULLIF(BTRIM(_notes), ''), auth.uid()
  )
  RETURNING id INTO history_id;

  INSERT INTO public.inventory_batches (
    organization_id, branch_id, product_id, batch_number, expiration_date,
    initial_quantity, remaining_quantity, unit_cost, source_type, source_id
  )
  SELECT
    products.organization_id, products.branch_id, products.id,
    'MAN-' || upper(left(replace(history_id::text, '-', ''), 10)),
    _expiration_date, _quantity, _quantity, products.cost_price,
    'manual_production', history_id
  FROM public.products products
  WHERE products.id = _product_id
  RETURNING id INTO batch_id;

  INSERT INTO public.inventory_batch_movements (
    batch_id, direction, quantity, source_type, source_id, created_by
  )
  VALUES (
    batch_id, 'in', _quantity, 'manual_production', history_id, auth.uid()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_manual_production(uuid, numeric, text, date)
TO authenticated;

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
  movement_row public.inventory_batch_movements%ROWTYPE;
  quantity_delta numeric;
  inventory_batch_id uuid;
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
  WHERE source_type = 'manual_production' AND source_id = history_row.id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This production record has no inventory batch and cannot be safely edited.';
  END IF;

  quantity_delta := _quantity - history_row.change_amount;
  IF quantity_delta < 0 AND (
    batch_row.remaining_quantity < abs(quantity_delta)
    OR product_row.current_stock < abs(quantity_delta)
  ) THEN
    RAISE EXCEPTION 'The produced stock has already been used. This edit would make inventory negative.';
  END IF;

  UPDATE public.products
  SET current_stock = current_stock + quantity_delta
  WHERE id = product_row.id;

  UPDATE public.inventory_batches
  SET initial_quantity = initial_quantity + quantity_delta,
      remaining_quantity = remaining_quantity + quantity_delta,
      expiration_date = _expiration_date
  WHERE id = batch_row.id;
  inventory_batch_id := batch_row.id;

  SELECT * INTO movement_row
  FROM public.inventory_batch_movements
  WHERE batch_id = batch_row.id
    AND source_type = 'manual_production'
    AND source_id = history_row.id
    AND direction = 'in'
  ORDER BY created_at
  LIMIT 1
  FOR UPDATE;

  IF FOUND THEN
    UPDATE public.inventory_batch_movements
    SET quantity = _quantity
    WHERE id = movement_row.id;
  ELSE
    INSERT INTO public.inventory_batch_movements (
      batch_id, direction, quantity, source_type, source_id, created_by
    )
    VALUES (
      inventory_batch_id, 'in', _quantity, 'manual_production',
      history_row.id, auth.uid()
    );
  END IF;

  UPDATE public.stock_history
  SET previous_stock = history_row.previous_stock,
      new_stock = history_row.previous_stock + _quantity,
      change_amount = _quantity,
      notes = NULLIF(BTRIM(_notes), '')
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
  WHERE source_type = 'manual_production' AND source_id = history_row.id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This production record has no inventory batch and cannot be safely deleted.';
  END IF;

  IF batch_row.remaining_quantity < history_row.change_amount
    OR product_row.current_stock < history_row.change_amount THEN
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
      batch_row.id, 'in', history_row.change_amount,
      'manual_production', history_row.id, auth.uid()
    );
  END IF;

  UPDATE public.products
  SET current_stock = current_stock - history_row.change_amount
  WHERE id = product_row.id;

  UPDATE public.inventory_batches
  SET remaining_quantity = 0,
      source_type = 'manual_production_deleted',
      source_id = NULL
  WHERE id = batch_row.id;

  UPDATE public.inventory_batch_movements
  SET source_type = 'manual_production_deleted',
      source_id = NULL
  WHERE batch_id = batch_row.id
    AND source_type = 'manual_production'
    AND source_id = history_row.id;

  DELETE FROM public.stock_history WHERE id = history_row.id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_manual_production(uuid)
TO authenticated;

CREATE OR REPLACE FUNCTION public.update_work_order_with_batches(
  _work_order_id uuid,
  _product_id uuid,
  _bom_id uuid,
  _branch_id uuid,
  _quantity numeric,
  _labor_cost numeric,
  _overhead_cost numeric,
  _material_cost numeric,
  _total_cost numeric,
  _cost_per_unit numeric,
  _notes text,
  _materials jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  work_order_row public.work_orders%ROWTYPE;
  material_row public.work_order_materials%ROWTYPE;
  next_material record;
  current_quantity numeric;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to edit a work order.';
  END IF;
  IF _quantity IS NULL OR _quantity <= 0 THEN
    RAISE EXCEPTION 'Work order quantity must be greater than zero.';
  END IF;
  IF _materials IS NULL OR jsonb_typeof(_materials) <> 'array' THEN
    RAISE EXCEPTION 'Work order materials are invalid.';
  END IF;

  SELECT * INTO work_order_row
  FROM public.work_orders
  WHERE id = _work_order_id
  FOR UPDATE;
  IF NOT FOUND OR work_order_row.status NOT IN ('draft', 'approved', 'in_progress') THEN
    RAISE EXCEPTION 'Only unfinished work orders can be edited.';
  END IF;

  IF work_order_row.status IN ('approved', 'in_progress') THEN
    FOR material_row IN
      SELECT * FROM public.work_order_materials
      WHERE work_order_id = _work_order_id
    LOOP
      SELECT raw_materials.current_stock INTO current_quantity
      FROM public.raw_materials
      WHERE id = material_row.raw_material_id
      FOR UPDATE;
      IF current_quantity IS NULL THEN
        RAISE EXCEPTION 'Raw material % no longer exists.', material_row.raw_material_id;
      END IF;

      IF EXISTS (
        SELECT 1 FROM public.inventory_batch_movements
        WHERE source_type = 'work_order_material'
          AND source_id = material_row.id
          AND direction = 'out'
      ) THEN
        PERFORM public.restore_inventory_batches('work_order_material', material_row.id);
        UPDATE public.raw_materials
        SET current_stock = current_quantity + material_row.quantity_required
        WHERE id = material_row.raw_material_id;
        INSERT INTO public.raw_material_stock_history (
          raw_material_id, previous_stock, new_stock, change_amount,
          change_type, reference_type, reference_id, notes, changed_by
        )
        VALUES (
          material_row.raw_material_id, current_quantity,
          current_quantity + material_row.quantity_required,
          material_row.quantity_required, 'production_reversal',
          'work_order', _work_order_id,
          'Restored for edited ' || work_order_row.work_order_number,
          auth.uid()
        );
      ELSE
        PERFORM public.adjust_raw_material_batch_stock(
          material_row.raw_material_id,
          material_row.quantity_required,
          NULL,
          NULL,
          'Restored for edited legacy ' || work_order_row.work_order_number,
          'production_reversal'
        );
      END IF;
    END LOOP;
  END IF;

  DELETE FROM public.work_order_materials
  WHERE work_order_id = _work_order_id;

  UPDATE public.work_orders
  SET product_id = _product_id,
      bom_id = _bom_id,
      branch_id = _branch_id,
      quantity = _quantity,
      labor_cost = _labor_cost,
      overhead_cost = _overhead_cost,
      material_cost = _material_cost,
      total_cost = _total_cost,
      cost_per_unit = _cost_per_unit,
      notes = _notes
  WHERE id = _work_order_id;

  FOR next_material IN
    SELECT *
    FROM jsonb_to_recordset(_materials) AS material(
      raw_material_id uuid,
      quantity_required numeric,
      unit_cost numeric,
      total_cost numeric
    )
  LOOP
    IF next_material.quantity_required IS NULL OR next_material.quantity_required < 0 THEN
      RAISE EXCEPTION 'Work order material quantity is invalid.';
    END IF;

    INSERT INTO public.work_order_materials (
      work_order_id, raw_material_id, quantity_required, unit_cost, total_cost
    )
    VALUES (
      _work_order_id, next_material.raw_material_id,
      next_material.quantity_required, next_material.unit_cost, next_material.total_cost
    )
    RETURNING * INTO material_row;

    IF work_order_row.status IN ('approved', 'in_progress') THEN
      SELECT raw_materials.current_stock INTO current_quantity
      FROM public.raw_materials
      WHERE id = material_row.raw_material_id
      FOR UPDATE;
      IF current_quantity IS NULL OR current_quantity < material_row.quantity_required THEN
        RAISE EXCEPTION 'Insufficient stock for raw material %. Need %, have %.',
          material_row.raw_material_id, material_row.quantity_required, coalesce(current_quantity, 0);
      END IF;

      PERFORM public.consume_inventory_batches(
        NULL, NULL, material_row.raw_material_id, NULL,
        material_row.quantity_required, 'work_order_material', material_row.id
      );
      UPDATE public.raw_materials
      SET current_stock = current_quantity - material_row.quantity_required
      WHERE id = material_row.raw_material_id;
      INSERT INTO public.raw_material_stock_history (
        raw_material_id, previous_stock, new_stock, change_amount,
        change_type, reference_type, reference_id, notes, changed_by
      )
      VALUES (
        material_row.raw_material_id, current_quantity,
        current_quantity - material_row.quantity_required,
        -material_row.quantity_required, 'production_deduction',
        'work_order', _work_order_id,
        'Deducted for edited ' || work_order_row.work_order_number,
        auth.uid()
      );
    END IF;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_work_order_with_batches(
  uuid, uuid, uuid, uuid, numeric, numeric, numeric, numeric, numeric, numeric, text, jsonb
) TO authenticated;

CREATE OR REPLACE FUNCTION public.delete_work_order_with_batches(_work_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  work_order_row public.work_orders%ROWTYPE;
  product_row public.products%ROWTYPE;
  material_row public.work_order_materials%ROWTYPE;
  output_batch public.inventory_batches%ROWTYPE;
  material_stock numeric;
  stock_quantity numeric;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to delete a work order.';
  END IF;

  SELECT * INTO work_order_row
  FROM public.work_orders
  WHERE id = _work_order_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Work order not found.';
  END IF;

  IF work_order_row.status IN ('approved', 'in_progress') THEN
    PERFORM public.cancel_work_order_with_batches(_work_order_id);
  ELSIF work_order_row.status = 'completed' THEN
    SELECT * INTO product_row
    FROM public.products
    WHERE id = work_order_row.product_id
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Finished-goods product not found.';
    END IF;

    stock_quantity := work_order_row.quantity *
      CASE WHEN product_row.sub_unit_id IS NOT NULL
        THEN coalesce(product_row.sub_unit_factor, 1)
        ELSE 1
      END;

    SELECT * INTO output_batch
    FROM public.inventory_batches
    WHERE source_type = 'work_order' AND source_id = work_order_row.id
      AND product_id = work_order_row.product_id
    FOR UPDATE;
    IF NOT FOUND OR output_batch.remaining_quantity < stock_quantity THEN
      RAISE EXCEPTION 'Finished goods from this work order have already been used; the work order cannot be deleted.';
    END IF;

    IF product_row.current_stock < stock_quantity THEN
      RAISE EXCEPTION 'Deleting this work order would make finished-goods stock negative.';
    END IF;

    UPDATE public.products
    SET current_stock = current_stock - stock_quantity
    WHERE id = product_row.id;

    UPDATE public.inventory_batches
    SET remaining_quantity = remaining_quantity - stock_quantity,
        source_type = 'work_order_deleted',
        source_id = NULL
    WHERE id = output_batch.id;
    UPDATE public.inventory_batch_movements
    SET source_type = 'work_order_deleted',
        source_id = NULL
    WHERE batch_id = output_batch.id
      AND source_type = 'work_order'
      AND source_id = work_order_row.id;

    INSERT INTO public.stock_history (
      product_id, previous_stock, new_stock, change_amount,
      change_type, notes, changed_by
    )
    VALUES (
      product_row.id, product_row.current_stock,
      product_row.current_stock - stock_quantity, -stock_quantity,
      'decrease', 'Deleted work order ' || work_order_row.work_order_number,
      auth.uid()
    );

    FOR material_row IN
      SELECT * FROM public.work_order_materials
      WHERE work_order_id = work_order_row.id
    LOOP
      SELECT raw_materials.current_stock INTO material_stock
      FROM public.raw_materials
      WHERE id = material_row.raw_material_id
      FOR UPDATE;
      IF material_stock IS NULL THEN
        RAISE EXCEPTION 'Raw material % no longer exists.', material_row.raw_material_id;
      END IF;

      IF EXISTS (
        SELECT 1 FROM public.inventory_batch_movements
        WHERE source_type = 'work_order_material'
          AND source_id = material_row.id
          AND direction = 'out'
      ) THEN
        PERFORM public.restore_inventory_batches('work_order_material', material_row.id);
        UPDATE public.raw_materials
        SET current_stock = material_stock + material_row.quantity_required
        WHERE id = material_row.raw_material_id;
        INSERT INTO public.raw_material_stock_history (
          raw_material_id, previous_stock, new_stock, change_amount,
          change_type, reference_type, reference_id, notes, changed_by
        )
        VALUES (
          material_row.raw_material_id, material_stock,
          material_stock + material_row.quantity_required,
          material_row.quantity_required, 'production_reversal',
          'work_order', work_order_row.id,
          'Restored for deleted ' || work_order_row.work_order_number,
          auth.uid()
        );
      ELSE
        PERFORM public.adjust_raw_material_batch_stock(
          material_row.raw_material_id,
          material_row.quantity_required,
          NULL,
          NULL,
          'Restored for deleted legacy ' || work_order_row.work_order_number,
          'production_reversal'
        );
      END IF;
    END LOOP;
  END IF;

  DELETE FROM public.work_orders WHERE id = work_order_row.id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_work_order_with_batches(uuid)
TO authenticated;
