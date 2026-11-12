CREATE OR REPLACE FUNCTION public.sync_product_expiry_to_opening_batches()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  UPDATE public.inventory_batches
  SET expiration_date = NEW.expiration_date
  WHERE product_id = NEW.id
    AND (source_type = 'opening' OR batch_number LIKE 'OPEN-%')
    AND expiration_date IS DISTINCT FROM NEW.expiration_date;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_inventory_batch_expiration_to_source()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.purchase_item_id IS NOT NULL THEN
    UPDATE public.purchase_items
    SET expiration_date = NEW.expiration_date
    WHERE id = NEW.purchase_item_id
      AND expiration_date IS DISTINCT FROM NEW.expiration_date;
  ELSIF NEW.product_id IS NOT NULL
    AND (NEW.source_type = 'opening' OR NEW.batch_number LIKE 'OPEN-%') THEN
    UPDATE public.products
    SET expiration_date = NEW.expiration_date
    WHERE id = NEW.product_id
      AND expiration_date IS DISTINCT FROM NEW.expiration_date;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.sync_purchase_item_expiration_to_batch()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  UPDATE public.inventory_batches
  SET expiration_date = NEW.expiration_date
  WHERE purchase_item_id = NEW.id
    AND expiration_date IS DISTINCT FROM NEW.expiration_date;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS inventory_batches_sync_expiration_to_source ON public.inventory_batches;
CREATE TRIGGER inventory_batches_sync_expiration_to_source
AFTER UPDATE OF expiration_date ON public.inventory_batches
FOR EACH ROW
WHEN (OLD.expiration_date IS DISTINCT FROM NEW.expiration_date)
EXECUTE FUNCTION public.sync_inventory_batch_expiration_to_source();

DROP TRIGGER IF EXISTS purchase_items_sync_expiration_to_batch ON public.purchase_items;
CREATE TRIGGER purchase_items_sync_expiration_to_batch
AFTER UPDATE OF expiration_date ON public.purchase_items
FOR EACH ROW
WHEN (OLD.expiration_date IS DISTINCT FROM NEW.expiration_date)
EXECUTE FUNCTION public.sync_purchase_item_expiration_to_batch();

REVOKE ALL ON FUNCTION public.sync_product_expiry_to_opening_batches() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_inventory_batch_expiration_to_source() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_purchase_item_expiration_to_batch() FROM PUBLIC, anon, authenticated;