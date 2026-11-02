ALTER TABLE public.purchase_items
  ADD COLUMN IF NOT EXISTS batch_number text;
