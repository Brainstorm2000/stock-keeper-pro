-- Add nullable FK link from sales & debt_payments to payment_methods so each
-- payment method (built-in or custom) can be tracked independently for
-- display and reporting. Legacy enum column is kept for backward compatibility.
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS payment_method_id uuid REFERENCES public.payment_methods(id) ON DELETE SET NULL;

ALTER TABLE public.debt_payments
  ADD COLUMN IF NOT EXISTS payment_method_id uuid REFERENCES public.payment_methods(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sales_payment_method_id ON public.sales(payment_method_id);
CREATE INDEX IF NOT EXISTS idx_debt_payments_payment_method_id ON public.debt_payments(payment_method_id);