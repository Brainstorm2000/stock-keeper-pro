
-- Helper function: check if a user's org has an active (non-expired) subscription
CREATE OR REPLACE FUNCTION public.has_active_subscription(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_subscriptions os
    JOIN public.profiles p ON p.organization_id = os.organization_id
    WHERE p.user_id = _user_id
      AND os.status IN ('active', 'trial')
      AND (
        (os.status = 'trial' AND (os.trial_end_date IS NULL OR os.trial_end_date > now()))
        OR
        (os.status = 'active' AND (os.subscription_end_date IS NULL OR os.subscription_end_date > now()))
      )
  )
  -- Super super admins always bypass
  OR public.is_super_super_admin(_user_id)
$$;

-- RESTRICTIVE policies on write operations for key tables
-- These are ANDed with existing permissive policies

-- Products
CREATE POLICY "Subscription required for product writes"
ON public.products AS RESTRICTIVE
FOR ALL TO authenticated
USING (public.has_active_subscription(auth.uid()))
WITH CHECK (public.has_active_subscription(auth.uid()));

-- Sales
CREATE POLICY "Subscription required for sale writes"
ON public.sales AS RESTRICTIVE
FOR INSERT TO authenticated
WITH CHECK (public.has_active_subscription(auth.uid()));

CREATE POLICY "Subscription required for sale updates"
ON public.sales AS RESTRICTIVE
FOR UPDATE TO authenticated
USING (public.has_active_subscription(auth.uid()));

CREATE POLICY "Subscription required for sale deletes"
ON public.sales AS RESTRICTIVE
FOR DELETE TO authenticated
USING (public.has_active_subscription(auth.uid()));

-- Sale items
CREATE POLICY "Subscription required for sale item writes"
ON public.sale_items AS RESTRICTIVE
FOR INSERT TO authenticated
WITH CHECK (public.has_active_subscription(auth.uid()));

-- Purchases
CREATE POLICY "Subscription required for purchase writes"
ON public.purchases AS RESTRICTIVE
FOR INSERT TO authenticated
WITH CHECK (public.has_active_subscription(auth.uid()));

CREATE POLICY "Subscription required for purchase updates"
ON public.purchases AS RESTRICTIVE
FOR UPDATE TO authenticated
USING (public.has_active_subscription(auth.uid()));

CREATE POLICY "Subscription required for purchase deletes"
ON public.purchases AS RESTRICTIVE
FOR DELETE TO authenticated
USING (public.has_active_subscription(auth.uid()));

-- Purchase items
CREATE POLICY "Subscription required for purchase item writes"
ON public.purchase_items AS RESTRICTIVE
FOR INSERT TO authenticated
WITH CHECK (public.has_active_subscription(auth.uid()));

-- Expenses
CREATE POLICY "Subscription required for expense writes"
ON public.expenses AS RESTRICTIVE
FOR ALL TO authenticated
USING (public.has_active_subscription(auth.uid()))
WITH CHECK (public.has_active_subscription(auth.uid()));

-- Stock history
CREATE POLICY "Subscription required for stock history writes"
ON public.stock_history AS RESTRICTIVE
FOR INSERT TO authenticated
WITH CHECK (public.has_active_subscription(auth.uid()));

-- Work orders
CREATE POLICY "Subscription required for work order writes"
ON public.work_orders AS RESTRICTIVE
FOR ALL TO authenticated
USING (public.has_active_subscription(auth.uid()))
WITH CHECK (public.has_active_subscription(auth.uid()));

-- Branches
CREATE POLICY "Subscription required for branch writes"
ON public.branches AS RESTRICTIVE
FOR INSERT TO authenticated
WITH CHECK (public.has_active_subscription(auth.uid()));

CREATE POLICY "Subscription required for branch updates"
ON public.branches AS RESTRICTIVE
FOR UPDATE TO authenticated
USING (public.has_active_subscription(auth.uid()));

CREATE POLICY "Subscription required for branch deletes"
ON public.branches AS RESTRICTIVE
FOR DELETE TO authenticated
USING (public.has_active_subscription(auth.uid()));
