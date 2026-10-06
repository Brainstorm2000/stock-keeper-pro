DROP POLICY IF EXISTS "Admins can manage sale returns" ON public.sale_returns;

CREATE POLICY "Users create sale returns with return permission"
  ON public.sale_returns
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_same_organization(auth.uid(), organization_id)
    AND (
      public.is_super_admin(auth.uid())
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_module_permission(auth.uid(), 'returns'::app_module, 'create')
    )
  );

CREATE POLICY "Users edit sale returns with return permission"
  ON public.sale_returns
  FOR UPDATE TO authenticated
  USING (
    public.is_same_organization(auth.uid(), organization_id)
    AND (
      public.is_super_admin(auth.uid())
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_module_permission(auth.uid(), 'returns'::app_module, 'edit')
    )
  )
  WITH CHECK (
    public.is_same_organization(auth.uid(), organization_id)
    AND (
      public.is_super_admin(auth.uid())
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_module_permission(auth.uid(), 'returns'::app_module, 'edit')
    )
  );

CREATE POLICY "Users delete sale returns with return permission"
  ON public.sale_returns
  FOR DELETE TO authenticated
  USING (
    public.is_same_organization(auth.uid(), organization_id)
    AND (
      public.is_super_admin(auth.uid())
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_module_permission(auth.uid(), 'returns'::app_module, 'delete')
    )
  );

DROP POLICY IF EXISTS "Admins can manage sale return items" ON public.sale_return_items;

CREATE POLICY "Users create sale return items with return permission"
  ON public.sale_return_items
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1
    FROM public.sale_returns sr
    WHERE sr.id = sale_return_items.return_id
      AND public.is_same_organization(auth.uid(), sr.organization_id)
      AND (
        public.is_super_admin(auth.uid())
        OR public.has_role(auth.uid(), 'admin'::app_role)
        OR public.has_module_permission(auth.uid(), 'returns'::app_module, 'create')
      )
  ));

CREATE POLICY "Users edit sale return items with return permission"
  ON public.sale_return_items
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1
    FROM public.sale_returns sr
    WHERE sr.id = sale_return_items.return_id
      AND public.is_same_organization(auth.uid(), sr.organization_id)
      AND (
        public.is_super_admin(auth.uid())
        OR public.has_role(auth.uid(), 'admin'::app_role)
        OR public.has_module_permission(auth.uid(), 'returns'::app_module, 'edit')
      )
  ))
  WITH CHECK (EXISTS (
    SELECT 1
    FROM public.sale_returns sr
    WHERE sr.id = sale_return_items.return_id
      AND public.is_same_organization(auth.uid(), sr.organization_id)
      AND (
        public.is_super_admin(auth.uid())
        OR public.has_role(auth.uid(), 'admin'::app_role)
        OR public.has_module_permission(auth.uid(), 'returns'::app_module, 'edit')
      )
  ));

CREATE POLICY "Users delete sale return items with return permission"
  ON public.sale_return_items
  FOR DELETE TO authenticated
  USING (EXISTS (
    SELECT 1
    FROM public.sale_returns sr
    WHERE sr.id = sale_return_items.return_id
      AND public.is_same_organization(auth.uid(), sr.organization_id)
      AND (
        public.is_super_admin(auth.uid())
        OR public.has_role(auth.uid(), 'admin'::app_role)
        OR public.has_module_permission(auth.uid(), 'returns'::app_module, 'edit')
        OR public.has_module_permission(auth.uid(), 'returns'::app_module, 'delete')
      )
  ));

CREATE POLICY "Subscription required for sale return updates"
  ON public.sale_returns
  AS RESTRICTIVE
  FOR UPDATE TO authenticated
  USING (public.has_active_subscription(auth.uid()))
  WITH CHECK (public.has_active_subscription(auth.uid()));

CREATE OR REPLACE FUNCTION public.adjust_sale_return_stock(
  _product_id uuid,
  _variation_id uuid,
  _change_amount numeric,
  _return_number text,
  _permission text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  product_row public.products%ROWTYPE;
  previous_stock numeric;
  new_stock numeric;
BEGIN
  IF auth.uid() IS NULL OR _change_amount = 0 THEN
    RAISE EXCEPTION 'Invalid sale return stock adjustment.';
  END IF;
  IF NOT public.has_active_subscription(auth.uid()) THEN
    RAISE EXCEPTION 'An active subscription is required.';
  END IF;
  IF _permission NOT IN ('create', 'edit', 'delete') OR NOT (
    public.is_super_admin(auth.uid())
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_module_permission(auth.uid(), 'returns'::app_module, _permission)
  ) THEN
    RAISE EXCEPTION 'You do not have permission to adjust sale return stock.';
  END IF;

  SELECT * INTO product_row
    FROM public.products
   WHERE id = _product_id;
  IF NOT FOUND OR NOT public.is_same_organization(auth.uid(), product_row.organization_id) THEN
    RAISE EXCEPTION 'Product not found in your organization.';
  END IF;

  IF _variation_id IS NOT NULL THEN
    SELECT current_stock INTO previous_stock
      FROM public.product_variations
     WHERE id = _variation_id AND product_id = _product_id
     FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Product variation not found.';
    END IF;
    new_stock := previous_stock + _change_amount;
    IF new_stock < 0 THEN
      RAISE EXCEPTION 'The returned quantity exceeds current variation stock.';
    END IF;
    UPDATE public.product_variations SET current_stock = new_stock WHERE id = _variation_id;
  ELSIF product_row.item_type = 'product' THEN
    previous_stock := product_row.current_stock;
    new_stock := previous_stock + _change_amount;
    IF new_stock < 0 THEN
      RAISE EXCEPTION 'The returned quantity exceeds current stock.';
    END IF;
    UPDATE public.products SET current_stock = new_stock WHERE id = _product_id;
  ELSE
    RETURN;
  END IF;

  INSERT INTO public.stock_history (
    product_id, variation_id, previous_stock, new_stock, change_amount,
    change_type, notes, changed_by
  ) VALUES (
    _product_id, _variation_id, previous_stock, new_stock, _change_amount,
    'sale_return', 'Sale return ' || _return_number, auth.uid()
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_sale_return_debt_credit(
  _return_id uuid,
  _permission text,
  _total_override numeric DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  return_row public.sale_returns%ROWTYPE;
  sale_row public.sales%ROWTYPE;
  previous_credit numeric;
  base_amount_paid numeric;
  base_balance numeric;
  credit_amount numeric;
  new_amount_paid numeric;
  new_balance numeric;
  new_status text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication is required.';
  END IF;
  IF NOT public.has_active_subscription(auth.uid()) THEN
    RAISE EXCEPTION 'An active subscription is required.';
  END IF;
  IF _permission NOT IN ('create', 'edit', 'delete') OR NOT (
    public.is_super_admin(auth.uid())
    OR public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_module_permission(auth.uid(), 'returns'::app_module, _permission)
  ) THEN
    RAISE EXCEPTION 'You do not have permission to update sale return credits.';
  END IF;

  SELECT * INTO return_row FROM public.sale_returns WHERE id = _return_id;
  IF NOT FOUND OR NOT public.is_same_organization(auth.uid(), return_row.organization_id) THEN
    RAISE EXCEPTION 'Sale return not found in your organization.';
  END IF;
  SELECT * INTO sale_row FROM public.sales WHERE id = return_row.sale_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Sale not found.';
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO previous_credit
    FROM public.debt_payments
   WHERE sale_return_id = _return_id;
  DELETE FROM public.debt_payments WHERE sale_return_id = _return_id;

  base_amount_paid := GREATEST(0, sale_row.amount_paid - previous_credit);
  base_balance := GREATEST(0, sale_row.total_amount - base_amount_paid);
  credit_amount := LEAST(COALESCE(_total_override, return_row.total_amount), base_balance);
  new_amount_paid := base_amount_paid + credit_amount;
  new_balance := GREATEST(0, sale_row.total_amount - new_amount_paid);
  new_status := CASE
    WHEN new_balance <= 0 THEN 'paid'
    WHEN new_amount_paid > 0 THEN 'partial'
    ELSE 'outstanding'
  END;

  UPDATE public.sales
     SET amount_paid = new_amount_paid,
         balance_due = new_balance,
         payment_status = new_status
   WHERE id = return_row.sale_id;

  IF credit_amount > 0 THEN
    INSERT INTO public.debt_payments (
      organization_id, sale_id, amount, payment_method, notes, paid_by, sale_return_id
    ) VALUES (
      return_row.organization_id, return_row.sale_id, credit_amount, 'store_credit',
      'Return credit from ' || return_row.return_number, auth.uid(), _return_id
    );
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.adjust_sale_return_stock(uuid, uuid, numeric, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.adjust_sale_return_stock(uuid, uuid, numeric, text, text) TO authenticated;
REVOKE ALL ON FUNCTION public.sync_sale_return_debt_credit(uuid, text, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sync_sale_return_debt_credit(uuid, text, numeric) TO authenticated;