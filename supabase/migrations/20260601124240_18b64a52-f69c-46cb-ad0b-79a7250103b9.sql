ALTER TABLE public.debt_payments ADD COLUMN IF NOT EXISTS sale_return_id uuid;
CREATE INDEX IF NOT EXISTS idx_debt_payments_sale_return_id ON public.debt_payments(sale_return_id);