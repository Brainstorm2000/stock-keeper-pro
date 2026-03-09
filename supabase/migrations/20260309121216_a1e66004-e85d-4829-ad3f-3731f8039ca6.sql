
-- Task comments table
CREATE TABLE public.task_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.action_tasks(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  user_id UUID NOT NULL,
  comment TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view comments in their org"
  ON public.task_comments FOR SELECT
  USING (is_same_organization(auth.uid(), organization_id));

CREATE POLICY "Authenticated users can add comments in their org"
  ON public.task_comments FOR INSERT
  TO authenticated
  WITH CHECK (is_same_organization(auth.uid(), organization_id) AND user_id = auth.uid());

CREATE POLICY "Users can delete their own comments"
  ON public.task_comments FOR DELETE
  USING (user_id = auth.uid());

-- Add amount_paid and balance_due to sales
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS amount_paid NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balance_due NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'paid',
  ADD COLUMN IF NOT EXISTS due_date DATE;

-- Update existing sales to have amount_paid = total_amount and balance_due = 0
UPDATE public.sales SET amount_paid = total_amount, balance_due = 0, payment_status = 'paid' WHERE amount_paid = 0;

-- Debt payments table to record partial payments against sales
CREATE TABLE public.debt_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id),
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'cash',
  notes TEXT,
  paid_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.debt_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view debt payments in their org"
  ON public.debt_payments FOR SELECT
  USING (is_same_organization(auth.uid(), organization_id));

CREATE POLICY "Admins can manage debt payments"
  ON public.debt_payments FOR ALL
  USING (is_same_organization(auth.uid(), organization_id) AND (is_super_admin(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role)))
  WITH CHECK (is_same_organization(auth.uid(), organization_id) AND (is_super_admin(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role)));
