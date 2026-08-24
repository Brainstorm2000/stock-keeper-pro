ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS expiration_date date;

COMMENT ON COLUMN public.products.expiration_date IS 'Optional expiration date for physical products; services should keep this NULL.';
