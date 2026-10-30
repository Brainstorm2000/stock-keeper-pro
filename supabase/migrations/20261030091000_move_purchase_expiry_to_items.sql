ALTER TABLE public.purchase_items
  ADD COLUMN IF NOT EXISTS expiration_date date;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'purchases'
      AND column_name = 'expiration_date'
  ) THEN
    UPDATE public.purchase_items AS items
    SET expiration_date = purchases.expiration_date
    FROM public.purchases
    WHERE purchases.id = items.purchase_id
      AND purchases.expiration_date IS NOT NULL;

    ALTER TABLE public.purchases
      DROP COLUMN expiration_date;
  END IF;
END
$$;
