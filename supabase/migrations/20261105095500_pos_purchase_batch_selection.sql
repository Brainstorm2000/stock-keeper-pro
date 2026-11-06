ALTER TABLE public.sale_items
  ADD COLUMN inventory_batch_id uuid
  REFERENCES public.inventory_batches(id)
  ON DELETE SET NULL;

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
