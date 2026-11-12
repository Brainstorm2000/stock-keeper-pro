ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS enable_batch_pos_sales boolean NOT NULL DEFAULT true;
