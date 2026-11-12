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
    AND source_type = 'opening'
    AND expiration_date IS DISTINCT FROM NEW.expiration_date;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS products_sync_opening_batch_expiration ON public.products;
CREATE TRIGGER products_sync_opening_batch_expiration
AFTER UPDATE OF expiration_date ON public.products
FOR EACH ROW
WHEN (OLD.expiration_date IS DISTINCT FROM NEW.expiration_date)
EXECUTE FUNCTION public.sync_product_expiry_to_opening_batches();

REVOKE ALL ON FUNCTION public.sync_product_expiry_to_opening_batches() FROM PUBLIC, anon, authenticated;