CREATE OR REPLACE FUNCTION public.assign_purchase_item_batch_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.batch_number IS NULL OR btrim(NEW.batch_number) = '' THEN
    NEW.batch_number := 'BN-' ||
      to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYYMMDDHH24MISS');
  ELSE
    NEW.batch_number := btrim(NEW.batch_number);
  END IF;

  RETURN NEW;
END;
$$;
