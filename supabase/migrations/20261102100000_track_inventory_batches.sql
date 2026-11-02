CREATE TABLE public.inventory_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE CASCADE,
  variation_id uuid REFERENCES public.product_variations(id) ON DELETE CASCADE,
  raw_material_id uuid REFERENCES public.raw_materials(id) ON DELETE CASCADE,
  purchase_item_id uuid UNIQUE REFERENCES public.purchase_items(id) ON DELETE SET NULL,
  batch_number text NOT NULL,
  expiration_date date,
  initial_quantity numeric NOT NULL CHECK (initial_quantity >= 0),
  remaining_quantity numeric NOT NULL CHECK (remaining_quantity >= 0),
  unit_cost numeric NOT NULL DEFAULT 0 CHECK (unit_cost >= 0),
  source_type text NOT NULL,
  source_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inventory_batches_item_check CHECK (
    (product_id IS NOT NULL AND raw_material_id IS NULL)
    OR (product_id IS NULL AND raw_material_id IS NOT NULL AND variation_id IS NULL)
  ),
  CONSTRAINT inventory_batches_quantity_check CHECK (remaining_quantity <= initial_quantity)
);

CREATE INDEX inventory_batches_product_fefo_idx
  ON public.inventory_batches (product_id, variation_id, branch_id, expiration_date, created_at)
  WHERE remaining_quantity > 0;
CREATE INDEX inventory_batches_raw_material_fefo_idx
  ON public.inventory_batches (raw_material_id, expiration_date, created_at)
  WHERE remaining_quantity > 0;

CREATE TABLE public.inventory_batch_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES public.inventory_batches(id) ON DELETE RESTRICT,
  direction text NOT NULL CHECK (direction IN ('in', 'out')),
  quantity numeric NOT NULL CHECK (quantity > 0),
  source_type text NOT NULL,
  source_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX inventory_batch_movements_source_idx
  ON public.inventory_batch_movements (source_type, source_id);

ALTER TABLE public.inventory_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_batch_movements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view inventory batches in their organization"
ON public.inventory_batches FOR SELECT
USING (public.is_same_organization(auth.uid(), organization_id));

CREATE POLICY "Users can manage inventory batches in their organization"
ON public.inventory_batches FOR ALL
USING (public.is_same_organization(auth.uid(), organization_id))
WITH CHECK (public.is_same_organization(auth.uid(), organization_id));

CREATE POLICY "Users can view inventory batch movements in their organization"
ON public.inventory_batch_movements FOR SELECT
USING (EXISTS (
  SELECT 1
  FROM public.inventory_batches batches
  WHERE batches.id = inventory_batch_movements.batch_id
    AND public.is_same_organization(auth.uid(), batches.organization_id)
));

CREATE POLICY "Users can manage inventory batch movements in their organization"
ON public.inventory_batch_movements FOR ALL
USING (EXISTS (
  SELECT 1
  FROM public.inventory_batches batches
  WHERE batches.id = inventory_batch_movements.batch_id
    AND public.is_same_organization(auth.uid(), batches.organization_id)
))
WITH CHECK (EXISTS (
  SELECT 1
  FROM public.inventory_batches batches
  WHERE batches.id = inventory_batch_movements.batch_id
    AND public.is_same_organization(auth.uid(), batches.organization_id)
));

INSERT INTO public.inventory_batches (
  organization_id, branch_id, product_id, batch_number, expiration_date,
  initial_quantity, remaining_quantity, unit_cost, source_type
)
SELECT
  products.organization_id, products.branch_id, products.id,
  'OPEN-' || upper(left(replace(products.id::text, '-', ''), 10)),
  products.expiration_date, products.current_stock, products.current_stock,
  products.cost_price, 'opening'
FROM public.products
WHERE products.current_stock > 0
ON CONFLICT DO NOTHING;

INSERT INTO public.inventory_batches (
  organization_id, branch_id, product_id, variation_id, batch_number,
  initial_quantity, remaining_quantity, unit_cost, source_type
)
SELECT
  products.organization_id, products.branch_id, products.id, variations.id,
  'OPEN-' || upper(left(replace(variations.id::text, '-', ''), 10)),
  variations.current_stock, variations.current_stock, variations.cost_price, 'opening'
FROM public.product_variations variations
JOIN public.products products ON products.id = variations.product_id
WHERE variations.current_stock > 0
ON CONFLICT DO NOTHING;

INSERT INTO public.inventory_batches (
  organization_id, raw_material_id, batch_number,
  initial_quantity, remaining_quantity, unit_cost, source_type
)
SELECT
  materials.organization_id, materials.id,
  'OPEN-' || upper(left(replace(materials.id::text, '-', ''), 10)),
  materials.current_stock, materials.current_stock, materials.cost_per_unit, 'opening'
FROM public.raw_materials materials
WHERE materials.current_stock > 0
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.assign_purchase_item_batch_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.batch_number IS NULL OR btrim(NEW.batch_number) = '' THEN
    NEW.batch_number := 'PO-' ||
      to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYYMMDD-HH24MISSMS') || '-' ||
      upper(left(replace(NEW.id::text, '-', ''), 8));
  ELSE
    NEW.batch_number := btrim(NEW.batch_number);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER purchase_items_assign_batch_number
BEFORE INSERT ON public.purchase_items
FOR EACH ROW EXECUTE FUNCTION public.assign_purchase_item_batch_number();

CREATE OR REPLACE FUNCTION public.create_purchase_item_batch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  purchase_row public.purchases%ROWTYPE;
  stock_quantity numeric;
BEGIN
  SELECT * INTO purchase_row
  FROM public.purchases
  WHERE id = NEW.purchase_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Purchase not found for purchase item.';
  END IF;

  stock_quantity := NEW.quantity * coalesce(NEW.unit_multiplier, 1);
  INSERT INTO public.inventory_batches (
    organization_id, branch_id, product_id, variation_id, purchase_item_id,
    batch_number, expiration_date, initial_quantity, remaining_quantity,
    unit_cost, source_type, source_id
  )
  VALUES (
    purchase_row.organization_id, purchase_row.branch_id, NEW.product_id,
    NEW.variation_id, NEW.id, NEW.batch_number, NEW.expiration_date,
    stock_quantity, stock_quantity,
    CASE WHEN stock_quantity = 0 THEN 0 ELSE NEW.total_cost / stock_quantity END,
    'purchase', NEW.purchase_id
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER purchase_items_create_inventory_batch
AFTER INSERT ON public.purchase_items
FOR EACH ROW EXECUTE FUNCTION public.create_purchase_item_batch();

CREATE OR REPLACE FUNCTION public.remove_unused_purchase_item_batch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.inventory_batch_movements movements
    JOIN public.inventory_batches batches ON batches.id = movements.batch_id
    WHERE batches.purchase_item_id = OLD.id
  ) THEN
    RAISE EXCEPTION 'This purchase batch has inventory movements and cannot be removed. Adjust the purchase through a stock correction instead.';
  END IF;

  DELETE FROM public.inventory_batches WHERE purchase_item_id = OLD.id;
  RETURN OLD;
END;
$$;

CREATE TRIGGER purchase_items_remove_unused_inventory_batch
BEFORE DELETE ON public.purchase_items
FOR EACH ROW EXECUTE FUNCTION public.remove_unused_purchase_item_batch();

CREATE OR REPLACE FUNCTION public.create_initial_product_batch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.current_stock > 0 THEN
    INSERT INTO public.inventory_batches (
      organization_id, branch_id, product_id, batch_number, expiration_date,
      initial_quantity, remaining_quantity, unit_cost, source_type
    )
    VALUES (
      NEW.organization_id, NEW.branch_id, NEW.id,
      'OPEN-' || upper(left(replace(NEW.id::text, '-', ''), 10)),
      NEW.expiration_date, NEW.current_stock, NEW.current_stock,
      NEW.cost_price, 'opening'
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER products_create_initial_batch
AFTER INSERT ON public.products
FOR EACH ROW EXECUTE FUNCTION public.create_initial_product_batch();

CREATE OR REPLACE FUNCTION public.create_initial_variation_batch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  parent_product public.products%ROWTYPE;
BEGIN
  IF NEW.current_stock > 0 THEN
    SELECT * INTO parent_product FROM public.products WHERE id = NEW.product_id;
    INSERT INTO public.inventory_batches (
      organization_id, branch_id, product_id, variation_id, batch_number,
      initial_quantity, remaining_quantity, unit_cost, source_type
    )
    VALUES (
      parent_product.organization_id, parent_product.branch_id, parent_product.id,
      NEW.id, 'OPEN-' || upper(left(replace(NEW.id::text, '-', ''), 10)),
      NEW.current_stock, NEW.current_stock, NEW.cost_price, 'opening'
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER product_variations_create_initial_batch
AFTER INSERT ON public.product_variations
FOR EACH ROW EXECUTE FUNCTION public.create_initial_variation_batch();

CREATE OR REPLACE FUNCTION public.create_initial_raw_material_batch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.current_stock > 0 THEN
    INSERT INTO public.inventory_batches (
      organization_id, raw_material_id, batch_number,
      initial_quantity, remaining_quantity, unit_cost, source_type
    )
    VALUES (
      NEW.organization_id, NEW.id,
      'OPEN-' || upper(left(replace(NEW.id::text, '-', ''), 10)),
      NEW.current_stock, NEW.current_stock, NEW.cost_per_unit, 'opening'
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER raw_materials_create_initial_batch
AFTER INSERT ON public.raw_materials
FOR EACH ROW EXECUTE FUNCTION public.create_initial_raw_material_batch();

CREATE OR REPLACE FUNCTION public.consume_inventory_batches(
  _product_id uuid,
  _variation_id uuid,
  _raw_material_id uuid,
  _branch_id uuid,
  _quantity numeric,
  _source_type text,
  _source_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  batch_row public.inventory_batches%ROWTYPE;
  remaining_to_consume numeric := _quantity;
  quantity_from_batch numeric;
BEGIN
  IF _quantity IS NULL OR _quantity <= 0 THEN
    RAISE EXCEPTION 'Batch consumption quantity must be greater than zero.';
  END IF;

  IF num_nonnulls(_product_id, _raw_material_id) <> 1 THEN
    RAISE EXCEPTION 'Specify exactly one product or raw material for batch consumption.';
  END IF;

  FOR batch_row IN
    SELECT batches.*
    FROM public.inventory_batches batches
    WHERE batches.remaining_quantity > 0
      AND (
        (_product_id IS NOT NULL
          AND batches.product_id = _product_id
          AND batches.variation_id IS NOT DISTINCT FROM _variation_id
          AND (_branch_id IS NULL OR batches.branch_id = _branch_id))
        OR (_raw_material_id IS NOT NULL AND batches.raw_material_id = _raw_material_id)
      )
      AND public.is_same_organization(auth.uid(), batches.organization_id)
    ORDER BY batches.expiration_date ASC NULLS LAST, batches.created_at ASC, batches.id
    FOR UPDATE
  LOOP
    quantity_from_batch := least(batch_row.remaining_quantity, remaining_to_consume);
    UPDATE public.inventory_batches
    SET remaining_quantity = remaining_quantity - quantity_from_batch
    WHERE id = batch_row.id;

    INSERT INTO public.inventory_batch_movements (
      batch_id, direction, quantity, source_type, source_id, created_by
    )
    VALUES (
      batch_row.id, 'out', quantity_from_batch, _source_type, _source_id, auth.uid()
    );

    remaining_to_consume := remaining_to_consume - quantity_from_batch;
    EXIT WHEN remaining_to_consume <= 0;
  END LOOP;

  IF remaining_to_consume > 0 THEN
    RAISE EXCEPTION 'Insufficient batch stock. % additional units are required.', remaining_to_consume;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.consume_inventory_batches(uuid, uuid, uuid, uuid, numeric, text, uuid)
TO authenticated;

CREATE OR REPLACE FUNCTION public.adjust_raw_material_batch_stock(
  _raw_material_id uuid,
  _change_amount numeric,
  _batch_number text DEFAULT NULL,
  _expiration_date date DEFAULT NULL,
  _notes text DEFAULT NULL,
  _change_type text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  material_row public.raw_materials%ROWTYPE;
  history_id uuid := gen_random_uuid();
  next_stock numeric;
  batch_id uuid;
  normalized_batch_number text;
  history_change_type text;
BEGIN
  IF _change_amount IS NULL OR _change_amount = 0 THEN
    RAISE EXCEPTION 'Stock adjustment must be non-zero.';
  END IF;

  SELECT * INTO material_row
  FROM public.raw_materials
  WHERE id = _raw_material_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Raw material not found.';
  END IF;
  history_change_type := coalesce(
    nullif(btrim(_change_type), ''),
    CASE WHEN _change_amount > 0 THEN 'purchase' ELSE 'adjustment' END
  );

  next_stock := material_row.current_stock + _change_amount;
  IF next_stock < 0 THEN
    RAISE EXCEPTION 'Raw material stock cannot be negative.';
  END IF;

  IF _change_amount > 0 THEN
    normalized_batch_number := nullif(btrim(_batch_number), '');
    IF normalized_batch_number IS NULL THEN
      normalized_batch_number := 'RM-' || upper(left(replace(history_id::text, '-', ''), 10));
    END IF;
    INSERT INTO public.inventory_batches (
      organization_id, raw_material_id, batch_number, expiration_date,
      initial_quantity, remaining_quantity, unit_cost, source_type, source_id
    )
    VALUES (
      material_row.organization_id, material_row.id, normalized_batch_number,
      _expiration_date, _change_amount, _change_amount, material_row.cost_per_unit,
      'raw_material_receipt', history_id
    )
    RETURNING id INTO batch_id;

    INSERT INTO public.inventory_batch_movements (
      batch_id, direction, quantity, source_type, source_id, created_by
    )
    VALUES (batch_id, 'in', _change_amount, 'raw_material_receipt', history_id, auth.uid());
  ELSE
    PERFORM public.consume_inventory_batches(
      NULL, NULL, material_row.id, NULL, abs(_change_amount),
      'raw_material_adjustment', history_id
    );
  END IF;

  UPDATE public.raw_materials
  SET current_stock = next_stock
  WHERE id = material_row.id;

  INSERT INTO public.raw_material_stock_history (
    id, raw_material_id, previous_stock, new_stock, change_amount,
    change_type, reference_type, reference_id, notes, changed_by
  )
  VALUES (
    history_id, material_row.id, material_row.current_stock, next_stock,
    _change_amount, history_change_type,
    'inventory_batch', history_id, nullif(btrim(_notes), ''), auth.uid()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.adjust_raw_material_batch_stock(uuid, numeric, text, date, text, text)
TO authenticated;

CREATE OR REPLACE FUNCTION public.adjust_product_batch_stock(
  _product_id uuid,
  _change_amount numeric,
  _batch_number text DEFAULT NULL,
  _expiration_date date DEFAULT NULL,
  _notes text DEFAULT NULL,
  _variation_id uuid DEFAULT NULL,
  _change_type text DEFAULT NULL,
  _movement_source_type text DEFAULT NULL,
  _movement_source_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  product_row public.products%ROWTYPE;
  variation_row public.product_variations%ROWTYPE;
  history_id uuid := gen_random_uuid();
  previous_stock numeric;
  next_stock numeric;
  stock_cost numeric;
  batch_id uuid;
  normalized_batch_number text;
  history_change_type text;
BEGIN
  IF _change_amount IS NULL OR _change_amount = 0 THEN
    RAISE EXCEPTION 'Stock adjustment must be non-zero.';
  END IF;

  SELECT * INTO product_row
  FROM public.products
  WHERE id = _product_id
  FOR UPDATE;

  IF NOT FOUND OR product_row.item_type = 'service' THEN
    RAISE EXCEPTION 'Stock-managed product not found.';
  END IF;
  history_change_type := coalesce(
    nullif(btrim(_change_type), ''),
    CASE WHEN _change_amount > 0 THEN 'increase' ELSE 'decrease' END
  );

  IF _variation_id IS NOT NULL THEN
    SELECT * INTO variation_row
    FROM public.product_variations
    WHERE id = _variation_id AND product_id = _product_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product variation not found.';
    END IF;
    previous_stock := variation_row.current_stock;
    stock_cost := variation_row.cost_price;
  ELSE
    previous_stock := product_row.current_stock;
    stock_cost := product_row.cost_price;
  END IF;

  next_stock := previous_stock + _change_amount;
  IF next_stock < 0 THEN
    RAISE EXCEPTION 'Product stock cannot be negative.';
  END IF;

  IF _change_amount > 0 THEN
    normalized_batch_number := nullif(btrim(_batch_number), '');
    IF normalized_batch_number IS NULL THEN
      normalized_batch_number := 'ADJ-' || upper(left(replace(history_id::text, '-', ''), 10));
    END IF;
    INSERT INTO public.inventory_batches (
      organization_id, branch_id, product_id, variation_id, batch_number, expiration_date,
      initial_quantity, remaining_quantity, unit_cost, source_type, source_id
    )
    VALUES (
      product_row.organization_id, product_row.branch_id, product_row.id,
      _variation_id, normalized_batch_number, _expiration_date, _change_amount, _change_amount,
      stock_cost, 'stock_adjustment', history_id
    )
    RETURNING id INTO batch_id;

    INSERT INTO public.inventory_batch_movements (
      batch_id, direction, quantity, source_type, source_id, created_by
    )
    VALUES (batch_id, 'in', _change_amount, 'stock_adjustment', history_id, auth.uid());
  ELSE
    PERFORM public.consume_inventory_batches(
      product_row.id, _variation_id, NULL, product_row.branch_id,
      abs(_change_amount), 'stock_adjustment', history_id
    );
    IF _movement_source_type IS NOT NULL AND _movement_source_id IS NOT NULL THEN
      UPDATE public.inventory_batch_movements
      SET source_type = _movement_source_type, source_id = _movement_source_id
      WHERE source_type = 'stock_adjustment'
        AND source_id = history_id
        AND direction = 'out';
    END IF;
  END IF;

  IF _variation_id IS NOT NULL THEN
    UPDATE public.product_variations
    SET current_stock = next_stock
    WHERE id = _variation_id;
  ELSE
    UPDATE public.products
    SET current_stock = next_stock
    WHERE id = product_row.id;
  END IF;

  INSERT INTO public.stock_history (
    id, product_id, variation_id, previous_stock, new_stock, change_amount,
    change_type, notes, changed_by
  )
  VALUES (
    history_id, product_row.id, _variation_id, previous_stock, next_stock,
    _change_amount, history_change_type,
    nullif(btrim(_notes), ''), auth.uid()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.adjust_product_batch_stock(uuid, numeric, text, date, text, uuid, text, text, uuid)
TO authenticated;

CREATE OR REPLACE FUNCTION public.restore_inventory_batches(
  _source_type text,
  _source_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  movement_row public.inventory_batch_movements%ROWTYPE;
BEGIN
  FOR movement_row IN
    SELECT movements.*
    FROM public.inventory_batch_movements movements
    JOIN public.inventory_batches batches ON batches.id = movements.batch_id
    WHERE movements.source_type = _source_type
      AND movements.source_id = _source_id
      AND movements.direction = 'out'
      AND public.is_same_organization(auth.uid(), batches.organization_id)
    FOR UPDATE OF batches
  LOOP
    UPDATE public.inventory_batches
    SET remaining_quantity = remaining_quantity + movement_row.quantity
    WHERE id = movement_row.batch_id;

    INSERT INTO public.inventory_batch_movements (
      batch_id, direction, quantity, source_type, source_id, created_by
    )
    VALUES (
      movement_row.batch_id, 'in', movement_row.quantity,
      _source_type || '_reversal', _source_id, auth.uid()
    );
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.restore_inventory_batches(text, uuid)
TO authenticated;

CREATE OR REPLACE FUNCTION public.undo_purchase_return_batch(_return_item_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  return_item public.purchase_return_items%ROWTYPE;
  product_row public.products%ROWTYPE;
  variation_row public.product_variations%ROWTYPE;
  previous_stock numeric;
  restore_quantity numeric;
BEGIN
  SELECT * INTO return_item
  FROM public.purchase_return_items
  WHERE id = _return_item_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Purchase return item not found.';
  END IF;

  restore_quantity := return_item.quantity * coalesce(return_item.unit_multiplier, 1);
  IF NOT EXISTS (
    SELECT 1
    FROM public.inventory_batch_movements
    WHERE source_type = 'purchase_return'
      AND source_id = return_item.id
      AND direction = 'out'
  ) THEN
    PERFORM public.adjust_product_batch_stock(
      return_item.product_id,
      restore_quantity,
      NULL,
      NULL,
      'Undo purchase return',
      return_item.variation_id,
      'purchase_return_reversal'
    );
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.inventory_batch_movements
    WHERE source_type = 'purchase_return_reversal'
      AND source_id = return_item.id
      AND direction = 'in'
  ) THEN
    RAISE EXCEPTION 'This purchase return has already been undone.';
  END IF;

  SELECT * INTO product_row
  FROM public.products
  WHERE id = return_item.product_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found.';
  END IF;

  IF return_item.variation_id IS NOT NULL THEN
    SELECT * INTO variation_row
    FROM public.product_variations
    WHERE id = return_item.variation_id
      AND product_id = return_item.product_id
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product variation not found.';
    END IF;
    previous_stock := variation_row.current_stock;
    UPDATE public.product_variations
    SET current_stock = current_stock + restore_quantity
    WHERE id = return_item.variation_id;
  ELSE
    previous_stock := product_row.current_stock;
    UPDATE public.products
    SET current_stock = current_stock + restore_quantity
    WHERE id = return_item.product_id;
  END IF;

  PERFORM public.restore_inventory_batches('purchase_return', return_item.id);

  INSERT INTO public.stock_history (
    product_id, variation_id, previous_stock, new_stock, change_amount,
    change_type, notes, changed_by
  )
  VALUES (
    return_item.product_id, return_item.variation_id,
    previous_stock, previous_stock + restore_quantity, restore_quantity,
    'purchase_return_reversal', 'Undo purchase return', auth.uid()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.undo_purchase_return_batch(uuid)
TO authenticated;

CREATE OR REPLACE FUNCTION public.approve_work_order_with_batches(_work_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  work_order_row public.work_orders%ROWTYPE;
  material_row public.work_order_materials%ROWTYPE;
  current_quantity numeric;
BEGIN
  SELECT * INTO work_order_row
  FROM public.work_orders
  WHERE id = _work_order_id
  FOR UPDATE;

  IF NOT FOUND OR work_order_row.status <> 'draft' THEN
    RAISE EXCEPTION 'Only draft work orders can be approved.';
  END IF;

  FOR material_row IN
    SELECT * FROM public.work_order_materials
    WHERE work_order_id = _work_order_id
  LOOP
    SELECT current_stock INTO current_quantity
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
    SET current_stock = current_stock - material_row.quantity_required
    WHERE id = material_row.raw_material_id;

    INSERT INTO public.raw_material_stock_history (
      raw_material_id, previous_stock, new_stock, change_amount, change_type,
      reference_type, reference_id, notes, changed_by
    )
    VALUES (
      material_row.raw_material_id,
      current_quantity,
      current_quantity - material_row.quantity_required,
      -material_row.quantity_required,
      'production_deduction',
      'work_order',
      _work_order_id,
      'Deducted for ' || work_order_row.work_order_number,
      auth.uid()
    );
  END LOOP;

  UPDATE public.work_orders
  SET status = 'approved', approved_at = now()
  WHERE id = _work_order_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_work_order_with_batches(uuid)
TO authenticated;

CREATE OR REPLACE FUNCTION public.cancel_work_order_with_batches(_work_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  work_order_row public.work_orders%ROWTYPE;
  material_row public.work_order_materials%ROWTYPE;
  current_quantity numeric;
BEGIN
  SELECT * INTO work_order_row
  FROM public.work_orders
  WHERE id = _work_order_id
  FOR UPDATE;

  IF NOT FOUND OR work_order_row.status NOT IN ('draft', 'approved', 'in_progress') THEN
    RAISE EXCEPTION 'Only unfinished work orders can be cancelled.';
  END IF;

  IF work_order_row.status IN ('approved', 'in_progress') THEN
    FOR material_row IN
      SELECT * FROM public.work_order_materials
      WHERE work_order_id = _work_order_id
    LOOP
      SELECT current_stock INTO current_quantity
      FROM public.raw_materials
      WHERE id = material_row.raw_material_id
      FOR UPDATE;

      IF current_quantity IS NULL THEN
        RAISE EXCEPTION 'Raw material % no longer exists.', material_row.raw_material_id;
      END IF;

      IF EXISTS (
        SELECT 1
        FROM public.inventory_batch_movements
        WHERE source_type = 'work_order_material'
          AND source_id = material_row.id
          AND direction = 'out'
      ) THEN
        PERFORM public.restore_inventory_batches('work_order_material', material_row.id);

        UPDATE public.raw_materials
        SET current_stock = current_stock + material_row.quantity_required
        WHERE id = material_row.raw_material_id;

        INSERT INTO public.raw_material_stock_history (
          raw_material_id, previous_stock, new_stock, change_amount, change_type,
          reference_type, reference_id, notes, changed_by
        )
        VALUES (
          material_row.raw_material_id,
          current_quantity,
          current_quantity + material_row.quantity_required,
          material_row.quantity_required,
          'production_reversal',
          'work_order',
          _work_order_id,
          'Restored for cancelled ' || work_order_row.work_order_number,
          auth.uid()
        );
      ELSE
        PERFORM public.adjust_raw_material_batch_stock(
          material_row.raw_material_id,
          material_row.quantity_required,
          NULL,
          NULL,
          'Restored for cancelled legacy ' || work_order_row.work_order_number,
          'production_reversal'
        );
      END IF;
    END LOOP;
  END IF;

  UPDATE public.work_orders
  SET status = 'cancelled'
  WHERE id = _work_order_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.cancel_work_order_with_batches(uuid)
TO authenticated;

CREATE OR REPLACE FUNCTION public.complete_work_order_with_batch(
  _work_order_id uuid,
  _expiration_date date DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  work_order_row public.work_orders%ROWTYPE;
  product_row public.products%ROWTYPE;
  previous_stock numeric;
  stock_quantity numeric;
  batch_number text;
BEGIN
  SELECT * INTO work_order_row
  FROM public.work_orders
  WHERE id = _work_order_id
  FOR UPDATE;

  IF NOT FOUND OR work_order_row.status NOT IN ('approved', 'in_progress') THEN
    RAISE EXCEPTION 'Only approved work orders can be completed.';
  END IF;

  SELECT * INTO product_row
  FROM public.products
  WHERE id = work_order_row.product_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Finished-goods product not found.';
  END IF;

  previous_stock := product_row.current_stock;
  stock_quantity := work_order_row.quantity *
    CASE WHEN product_row.sub_unit_id IS NOT NULL
      THEN coalesce(product_row.sub_unit_factor, 1)
      ELSE 1
    END;
  batch_number := 'WO-' || work_order_row.work_order_number;

  UPDATE public.products
  SET current_stock = current_stock + stock_quantity
  WHERE id = product_row.id;

  INSERT INTO public.inventory_batches (
    organization_id, branch_id, product_id, batch_number, expiration_date,
    initial_quantity, remaining_quantity, unit_cost, source_type, source_id
  )
  VALUES (
    product_row.organization_id, coalesce(work_order_row.branch_id, product_row.branch_id),
    product_row.id, batch_number, _expiration_date, stock_quantity,
    stock_quantity, work_order_row.cost_per_unit, 'work_order', work_order_row.id
  );

  INSERT INTO public.stock_history (
    product_id, previous_stock, new_stock, change_amount, change_type, notes, changed_by
  )
  VALUES (
    product_row.id, previous_stock, previous_stock + stock_quantity,
    stock_quantity, 'production',
    'Produced via ' || work_order_row.work_order_number, auth.uid()
  );

  UPDATE public.work_orders
  SET status = 'completed', completed_at = now()
  WHERE id = _work_order_id;

  RETURN batch_number;
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_work_order_with_batch(uuid, date)
TO authenticated;

CREATE OR REPLACE FUNCTION public.allocate_sale_item_batch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  sale_branch_id uuid;
  product_type text;
BEGIN
  SELECT branch_id INTO sale_branch_id FROM public.sales WHERE id = NEW.sale_id;
  SELECT item_type INTO product_type FROM public.products WHERE id = NEW.product_id;
  IF product_type = 'service' THEN
    RETURN NEW;
  END IF;

  PERFORM public.consume_inventory_batches(
    NEW.product_id,
    NEW.variation_id,
    NULL,
    sale_branch_id,
    NEW.quantity * coalesce(NEW.unit_multiplier, 1),
    'sale_item',
    NEW.id
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER sale_items_allocate_inventory_batch
AFTER INSERT ON public.sale_items
FOR EACH ROW EXECUTE FUNCTION public.allocate_sale_item_batch();

CREATE OR REPLACE FUNCTION public.restore_sale_item_batches()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  product_row public.products%ROWTYPE;
  sale_branch_id uuid;
  restore_quantity numeric;
BEGIN
  PERFORM public.restore_inventory_batches('sale_item', OLD.id);

  IF EXISTS (
    SELECT 1
    FROM public.inventory_batch_movements
    WHERE source_type = 'sale_item'
      AND source_id = OLD.id
      AND direction = 'out'
  ) THEN
    RETURN OLD;
  END IF;

  SELECT * INTO product_row
  FROM public.products
  WHERE id = OLD.product_id;
  IF NOT FOUND OR product_row.item_type = 'service' THEN
    RETURN OLD;
  END IF;

  restore_quantity := OLD.quantity * coalesce(OLD.unit_multiplier, 1);
  IF restore_quantity > 0 THEN
    SELECT branch_id INTO sale_branch_id
    FROM public.sales
    WHERE id = OLD.sale_id;

    INSERT INTO public.inventory_batches (
      organization_id, branch_id, product_id, variation_id, batch_number,
      initial_quantity, remaining_quantity, unit_cost, source_type, source_id
    )
    VALUES (
      product_row.organization_id, coalesce(sale_branch_id, product_row.branch_id),
      product_row.id, OLD.variation_id,
      'SALE-REV-' || upper(left(replace(OLD.id::text, '-', ''), 10)),
      restore_quantity, restore_quantity,
      coalesce(product_row.cost_price, 0), 'sale_reversal', OLD.id
    );
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER sale_items_restore_inventory_batches
BEFORE DELETE ON public.sale_items
FOR EACH ROW EXECUTE FUNCTION public.restore_sale_item_batches();

CREATE OR REPLACE FUNCTION public.record_manual_production(
  _product_id uuid,
  _quantity numeric,
  _notes text DEFAULT NULL,
  _expiration_date date DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path TO 'public'
AS $$
DECLARE
  previous_stock numeric;
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
    product_id, previous_stock, new_stock, change_amount, change_type, notes, changed_by
  )
  VALUES (
    _product_id, previous_stock, previous_stock + _quantity, _quantity,
    'manual_production', NULLIF(BTRIM(_notes), ''), auth.uid()
  )
  RETURNING id INTO batch_id;

  INSERT INTO public.inventory_batches (
    organization_id, branch_id, product_id, batch_number, expiration_date,
    initial_quantity, remaining_quantity, unit_cost, source_type, source_id
  )
  SELECT
    products.organization_id, products.branch_id, products.id,
    'MAN-' || upper(left(replace(batch_id::text, '-', ''), 10)),
    _expiration_date, _quantity, _quantity, products.cost_price,
    'manual_production', batch_id
  FROM public.products products
  WHERE products.id = _product_id;
END;
$$;

DROP FUNCTION IF EXISTS public.record_manual_production(uuid, numeric, text);
GRANT EXECUTE ON FUNCTION public.record_manual_production(uuid, numeric, text, date)
TO authenticated;
