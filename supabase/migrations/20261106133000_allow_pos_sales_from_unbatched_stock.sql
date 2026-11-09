ALTER TABLE public.sale_items
  ADD COLUMN IF NOT EXISTS uses_unbatched_stock boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.allocate_sale_item_batch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  sale_branch_id uuid;
  product_type text;
  selected_batch public.inventory_batches%ROWTYPE;
  stock_quantity numeric;
BEGIN
  SELECT branch_id INTO sale_branch_id
  FROM public.sales
  WHERE id = NEW.sale_id;

  SELECT item_type INTO product_type
  FROM public.products
  WHERE id = NEW.product_id;

  IF product_type = 'service' THEN
    RETURN NEW;
  END IF;

  stock_quantity := NEW.quantity * coalesce(NEW.unit_multiplier, 1);
  IF stock_quantity IS NULL OR stock_quantity <= 0 THEN
    RAISE EXCEPTION 'Batch consumption quantity must be greater than zero.';
  END IF;

  IF NEW.uses_unbatched_stock THEN
    IF NEW.inventory_batch_id IS NOT NULL THEN
      RAISE EXCEPTION 'Unbatched stock cannot specify an inventory batch.';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.inventory_batch_id IS NULL THEN
    PERFORM public.consume_inventory_batches(
      NEW.product_id,
      NEW.variation_id,
      NULL,
      sale_branch_id,
      stock_quantity,
      'sale_item',
      NEW.id
    );
    RETURN NEW;
  END IF;

  SELECT batches.* INTO selected_batch
  FROM public.inventory_batches batches
  WHERE batches.id = NEW.inventory_batch_id
    AND batches.product_id = NEW.product_id
    AND batches.variation_id IS NOT DISTINCT FROM NEW.variation_id
    AND (sale_branch_id IS NULL OR batches.branch_id = sale_branch_id)
    AND public.is_same_organization(auth.uid(), batches.organization_id)
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Selected inventory batch is unavailable or does not match this sale item.';
  END IF;

  IF selected_batch.remaining_quantity < stock_quantity THEN
    RAISE EXCEPTION 'Selected batch has % units available, but % are required.',
      selected_batch.remaining_quantity, stock_quantity;
  END IF;

  UPDATE public.inventory_batches
  SET remaining_quantity = remaining_quantity - stock_quantity
  WHERE id = selected_batch.id;

  INSERT INTO public.inventory_batch_movements (
    batch_id, direction, quantity, source_type, source_id, created_by
  )
  VALUES (
    selected_batch.id, 'out', stock_quantity, 'sale_item', NEW.id, auth.uid()
  );

  RETURN NEW;
END;
$$;

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
  IF OLD.uses_unbatched_stock THEN
    RETURN OLD;
  END IF;

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
