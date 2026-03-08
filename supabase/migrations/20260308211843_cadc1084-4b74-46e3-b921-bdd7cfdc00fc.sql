
-- Create pricing_plans table for plan tiers with user/branch limits
CREATE TABLE public.pricing_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  max_users integer NOT NULL DEFAULT 1,
  max_branches integer NOT NULL DEFAULT 1,
  base_price numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pricing_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view pricing plans" ON public.pricing_plans
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

CREATE POLICY "Super super admins can manage pricing plans" ON public.pricing_plans
  FOR ALL TO authenticated
  USING (is_super_super_admin(auth.uid()))
  WITH CHECK (is_super_super_admin(auth.uid()));

-- Add yearly discount to pricing_config
ALTER TABLE public.pricing_config ADD COLUMN yearly_discount_percent numeric NOT NULL DEFAULT 0;

-- Add billing_cycle and plan_id to organization_subscriptions
ALTER TABLE public.organization_subscriptions ADD COLUMN billing_cycle text NOT NULL DEFAULT 'monthly';
ALTER TABLE public.organization_subscriptions ADD COLUMN plan_id uuid REFERENCES public.pricing_plans(id);
