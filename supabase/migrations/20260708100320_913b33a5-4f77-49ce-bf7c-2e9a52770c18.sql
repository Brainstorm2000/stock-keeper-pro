ALTER TYPE public.app_module ADD VALUE IF NOT EXISTS 'dashboard_financials';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_products_is_archived ON public.products(is_archived);