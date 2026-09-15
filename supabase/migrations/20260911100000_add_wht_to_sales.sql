ALTER TABLE public.sales
ADD COLUMN wht_amount numeric NOT NULL DEFAULT 0 CHECK (wht_amount >= 0 AND wht_amount <= total_amount);

CREATE INDEX sales_wht_amount_idx ON public.sales (organization_id, created_at) WHERE wht_amount > 0;