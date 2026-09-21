ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_taxable boolean NOT NULL DEFAULT true;

UPDATE public.products
SET is_taxable = true
WHERE is_taxable IS NULL;
