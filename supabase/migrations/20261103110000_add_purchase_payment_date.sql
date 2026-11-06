ALTER TABLE public.purchases
  ADD COLUMN IF NOT EXISTS payment_date date;
