GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.purchase_payments TO authenticated;

CREATE POLICY "Admins can update payments for purchases"
ON public.purchase_payments
FOR UPDATE
USING (public.can_manage_purchase_payments(purchase_id))
WITH CHECK (public.can_manage_purchase_payments(purchase_id));

CREATE POLICY "Admins can delete payments for purchases"
ON public.purchase_payments
FOR DELETE
USING (public.can_manage_purchase_payments(purchase_id));
