
-- Pricing configuration (singleton-ish table for global pricing settings)
CREATE TABLE public.pricing_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  base_plan_price numeric NOT NULL DEFAULT 0,
  base_users_included integer NOT NULL DEFAULT 1,
  price_per_extra_user numeric NOT NULL DEFAULT 0,
  base_branches_included integer NOT NULL DEFAULT 1,
  price_per_extra_branch numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pricing_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super super admins can manage pricing config" ON public.pricing_config
  FOR ALL USING (is_super_super_admin(auth.uid()))
  WITH CHECK (is_super_super_admin(auth.uid()));

CREATE POLICY "Authenticated can view pricing config" ON public.pricing_config
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Pricing modules (available add-on modules)
CREATE TABLE public.pricing_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  monthly_price numeric NOT NULL DEFAULT 0,
  is_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pricing_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super super admins can manage pricing modules" ON public.pricing_modules
  FOR ALL USING (is_super_super_admin(auth.uid()))
  WITH CHECK (is_super_super_admin(auth.uid()));

CREATE POLICY "Authenticated can view pricing modules" ON public.pricing_modules
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Organization subscriptions
CREATE TABLE public.organization_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  number_of_users integer NOT NULL DEFAULT 1,
  number_of_branches integer NOT NULL DEFAULT 1,
  monthly_price numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id)
);

ALTER TABLE public.organization_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super super admins can manage subscriptions" ON public.organization_subscriptions
  FOR ALL USING (is_super_super_admin(auth.uid()))
  WITH CHECK (is_super_super_admin(auth.uid()));

CREATE POLICY "Org users can view their subscription" ON public.organization_subscriptions
  FOR SELECT USING (is_same_organization(auth.uid(), organization_id));

-- Subscription enabled modules (junction table)
CREATE TABLE public.subscription_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id uuid NOT NULL REFERENCES public.organization_subscriptions(id) ON DELETE CASCADE,
  pricing_module_id uuid NOT NULL REFERENCES public.pricing_modules(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(subscription_id, pricing_module_id)
);

ALTER TABLE public.subscription_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super super admins can manage subscription modules" ON public.subscription_modules
  FOR ALL USING (is_super_super_admin(auth.uid()))
  WITH CHECK (is_super_super_admin(auth.uid()));

CREATE POLICY "Org users can view their subscription modules" ON public.subscription_modules
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.organization_subscriptions os
      WHERE os.id = subscription_modules.subscription_id
      AND is_same_organization(auth.uid(), os.organization_id)
    )
  );

-- Insert default pricing config
INSERT INTO public.pricing_config (base_plan_price, base_users_included, price_per_extra_user, base_branches_included, price_per_extra_branch)
VALUES (0, 1, 0, 1, 0);
