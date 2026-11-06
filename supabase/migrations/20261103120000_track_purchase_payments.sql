CREATE TABLE public.purchase_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
  amount numeric NOT NULL CHECK (amount > 0),
  payment_date date,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_purchase_payments_purchase_id
  ON public.purchase_payments(purchase_id);

ALTER TABLE public.purchase_payments ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON public.purchase_payments TO authenticated;
GRANT ALL ON public.purchase_payments TO service_role;

CREATE OR REPLACE FUNCTION public.can_manage_purchase_payments(_purchase_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.purchases p
    WHERE p.id = _purchase_id
      AND is_same_organization(auth.uid(), p.organization_id)
      AND (is_super_admin(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))
  );
$$;

REVOKE ALL ON FUNCTION public.can_manage_purchase_payments(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_purchase_payments(uuid)
  TO authenticated;

CREATE POLICY "Users can view payments for accessible purchases"
ON public.purchase_payments
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.purchases p
    WHERE p.id = purchase_payments.purchase_id
      AND is_same_organization(auth.uid(), p.organization_id)
      AND (is_super_admin(auth.uid()) OR has_branch_access(auth.uid(), p.branch_id))
  )
);

CREATE POLICY "Admins can record payments for purchases"
ON public.purchase_payments
FOR INSERT
WITH CHECK (public.can_manage_purchase_payments(purchase_id));

INSERT INTO public.purchase_payments (
  purchase_id,
  amount,
  payment_date,
  created_by
)
SELECT id, amount_paid, payment_date, created_by
FROM public.purchases
WHERE amount_paid > 0;

CREATE OR REPLACE FUNCTION public.validate_purchase_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  purchase_total numeric;
  already_paid numeric;
BEGIN
  IF NEW.payment_date IS NULL THEN
    RAISE EXCEPTION 'A payment date is required for new purchase payments.';
  END IF;

  SELECT total_amount
  INTO purchase_total
  FROM public.purchases
  WHERE id = NEW.purchase_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Purchase not found.';
  END IF;

  SELECT COALESCE(SUM(amount), 0)
  INTO already_paid
  FROM public.purchase_payments
  WHERE purchase_id = NEW.purchase_id
    AND id IS DISTINCT FROM NEW.id;

  IF already_paid + NEW.amount > purchase_total THEN
    RAISE EXCEPTION 'Purchase payments cannot exceed the purchase total.';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_purchase_payment() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER validate_purchase_payment_before_write
BEFORE INSERT OR UPDATE ON public.purchase_payments
FOR EACH ROW
EXECUTE FUNCTION public.validate_purchase_payment();

CREATE OR REPLACE FUNCTION public.recalculate_purchase_payment_summary(_purchase_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  purchase_total numeric;
  payments_total numeric;
  latest_payment_date date;
BEGIN
  SELECT total_amount
  INTO purchase_total
  FROM public.purchases
  WHERE id = _purchase_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT COALESCE(SUM(amount), 0), MAX(payment_date)
  INTO payments_total, latest_payment_date
  FROM public.purchase_payments
  WHERE purchase_id = _purchase_id;

  UPDATE public.purchases
  SET amount_paid = payments_total,
      payment_date = latest_payment_date,
      payment_status = CASE
        WHEN payments_total <= 0 THEN 'pending'::public.purchase_payment_status
        WHEN payments_total >= purchase_total THEN 'paid'::public.purchase_payment_status
        ELSE 'partial'::public.purchase_payment_status
      END
  WHERE id = _purchase_id;
END;
$$;

REVOKE ALL ON FUNCTION public.recalculate_purchase_payment_summary(uuid)
  FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.sync_purchase_payment_summary_from_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalculate_purchase_payment_summary(OLD.purchase_id);
    RETURN OLD;
  END IF;

  PERFORM public.recalculate_purchase_payment_summary(NEW.purchase_id);
  IF TG_OP = 'UPDATE' AND OLD.purchase_id IS DISTINCT FROM NEW.purchase_id THEN
    PERFORM public.recalculate_purchase_payment_summary(OLD.purchase_id);
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_purchase_payment_summary_from_payment()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER sync_purchase_payment_summary_after_payment
AFTER INSERT OR UPDATE OR DELETE ON public.purchase_payments
FOR EACH ROW
EXECUTE FUNCTION public.sync_purchase_payment_summary_from_payment();

CREATE OR REPLACE FUNCTION public.sync_purchase_payment_summary_after_total_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.recalculate_purchase_payment_summary(NEW.id);
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_purchase_payment_summary_after_total_change()
  FROM PUBLIC, anon, authenticated;

CREATE TRIGGER sync_purchase_payment_summary_after_total_change
AFTER UPDATE OF total_amount ON public.purchases
FOR EACH ROW
WHEN (OLD.total_amount IS DISTINCT FROM NEW.total_amount)
EXECUTE FUNCTION public.sync_purchase_payment_summary_after_total_change();

DO $$
DECLARE
  purchase_row record;
BEGIN
  FOR purchase_row IN SELECT id FROM public.purchases LOOP
    PERFORM public.recalculate_purchase_payment_summary(purchase_row.id);
  END LOOP;
END;
$$;
