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
  product_row public.products%ROWTYPE;
  output_batch public.inventory_batches%ROWTYPE;
  next_material record;
  current_quantity numeric;
  old_output_quantity numeric;
  new_output_quantity numeric;
  output_delta numeric;
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
  IF NOT FOUND OR work_order_row.status NOT IN ('draft', 'approved', 'in_progress', 'completed') THEN
    RAISE EXCEPTION 'Only active or completed work orders can be edited.';
  END IF;

  IF work_order_row.status = 'completed' THEN
    IF _product_id IS DISTINCT FROM work_order_row.product_id
      OR _branch_id IS DISTINCT FROM work_order_row.branch_id THEN
      RAISE EXCEPTION 'A completed work order cannot change its product or branch.';
    END IF;

    SELECT * INTO product_row
    FROM public.products
    WHERE id = work_order_row.product_id
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Finished-goods product not found.';
    END IF;

    SELECT * INTO output_batch
    FROM public.inventory_batches
    WHERE source_type = 'work_order'
      AND source_id = work_order_row.id
      AND product_id = work_order_row.product_id
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'The completed work order batch was not found.';
    END IF;

    old_output_quantity := output_batch.initial_quantity;
    new_output_quantity := _quantity *
      CASE WHEN product_row.sub_unit_id IS NOT NULL
        THEN coalesce(product_row.sub_unit_factor, 1)
        ELSE 1
      END;
    output_delta := new_output_quantity - old_output_quantity;

    IF output_batch.remaining_quantity + output_delta < 0
      OR product_row.current_stock + output_delta < 0 THEN
      RAISE EXCEPTION 'Finished goods from this work order have already been used; this edit would make stock negative.';
    END IF;

    IF output_delta <> 0 THEN
      UPDATE public.products
      SET current_stock = current_stock + output_delta
      WHERE id = product_row.id;

      UPDATE public.inventory_batches
      SET initial_quantity = new_output_quantity,
          remaining_quantity = remaining_quantity + output_delta
      WHERE id = output_batch.id;

      INSERT INTO public.inventory_batch_movements (
        batch_id, direction, quantity, source_type, source_id, created_by
      )
      VALUES (
        output_batch.id,
        CASE WHEN output_delta > 0 THEN 'in' ELSE 'out' END,
        abs(output_delta), 'work_order', work_order_row.id, auth.uid()
      );

      INSERT INTO public.stock_history (
        product_id, previous_stock, new_stock, change_amount,
        change_type, notes, changed_by
      )
      VALUES (
        product_row.id, product_row.current_stock,
        product_row.current_stock + output_delta, output_delta,
        'adjustment',
        'Edited completed work order ' || work_order_row.work_order_number ||
          ': finished stock changed from ' || old_output_quantity::text ||
          ' to ' || new_output_quantity::text,
        auth.uid()
      );
    END IF;
  END IF;

  IF work_order_row.status IN ('approved', 'in_progress', 'completed') THEN
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

    IF work_order_row.status IN ('approved', 'in_progress', 'completed') THEN
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

CREATE POLICY "Production users can record authorized stock history"
ON public.stock_history
FOR INSERT TO authenticated
WITH CHECK (
  change_type IN ('manual_production', 'production', 'adjustment', 'decrease')
  AND change_amount = new_stock - previous_stock
  AND EXISTS (
    SELECT 1
    FROM public.products p
    WHERE p.id = stock_history.product_id
      AND p.item_type = 'product'
      AND p.current_stock = stock_history.new_stock
      AND public.is_same_organization(auth.uid(), p.organization_id)
      AND (
        public.is_super_admin(auth.uid())
        OR p.branch_id IS NULL
        OR public.has_branch_access(auth.uid(), p.branch_id)
      )
      AND (
        public.has_module_permission(auth.uid(), 'production'::public.app_module, 'create')
        OR public.has_module_permission(auth.uid(), 'production'::public.app_module, 'edit')
        OR public.has_module_permission(auth.uid(), 'production'::public.app_module, 'delete')
      )
  )
);

CREATE POLICY "Production users can record work order material history"
ON public.raw_material_stock_history
FOR INSERT TO authenticated
WITH CHECK (
  reference_type = 'work_order'
  AND change_type IN ('production_deduction', 'production_reversal')
  AND change_amount = new_stock - previous_stock
  AND EXISTS (
    SELECT 1
    FROM public.raw_materials rm
    WHERE rm.id = raw_material_stock_history.raw_material_id
      AND rm.current_stock = raw_material_stock_history.new_stock
      AND public.is_same_organization(auth.uid(), rm.organization_id)
      AND (
        public.is_super_admin(auth.uid())
        OR public.has_role(auth.uid(), 'admin'::public.app_role)
        OR public.has_module_permission(auth.uid(), 'production'::public.app_module, 'create')
        OR public.has_module_permission(auth.uid(), 'production'::public.app_module, 'edit')
        OR public.has_module_permission(auth.uid(), 'production'::public.app_module, 'delete')
      )
  )
);
