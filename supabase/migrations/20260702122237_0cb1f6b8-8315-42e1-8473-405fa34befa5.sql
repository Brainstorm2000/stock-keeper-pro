
CREATE TABLE public.payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  icon text NOT NULL DEFAULT 'Banknote',
  mapped_type public.payment_method NOT NULL DEFAULT 'cash',
  is_active boolean NOT NULL DEFAULT true,
  is_builtin boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (organization_id, name)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_methods TO authenticated;
GRANT ALL ON public.payment_methods TO service_role;

ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can view payment methods"
  ON public.payment_methods FOR SELECT TO authenticated
  USING (public.is_same_organization(auth.uid(), organization_id));

CREATE POLICY "Admins can insert payment methods"
  ON public.payment_methods FOR INSERT TO authenticated
  WITH CHECK (
    public.is_same_organization(auth.uid(), organization_id)
    AND (public.has_role(auth.uid(), 'admin') OR public.is_super_admin(auth.uid()))
  );

CREATE POLICY "Admins can update payment methods"
  ON public.payment_methods FOR UPDATE TO authenticated
  USING (
    public.is_same_organization(auth.uid(), organization_id)
    AND (public.has_role(auth.uid(), 'admin') OR public.is_super_admin(auth.uid()))
  );

CREATE POLICY "Admins can delete non-builtin payment methods"
  ON public.payment_methods FOR DELETE TO authenticated
  USING (
    public.is_same_organization(auth.uid(), organization_id)
    AND (public.has_role(auth.uid(), 'admin') OR public.is_super_admin(auth.uid()))
    AND is_builtin = false
  );

CREATE TRIGGER update_payment_methods_updated_at
  BEFORE UPDATE ON public.payment_methods
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed built-in methods for every existing organization
INSERT INTO public.payment_methods (organization_id, name, icon, mapped_type, is_builtin, sort_order)
SELECT o.id, m.name, m.icon, m.mapped_type::public.payment_method, true, m.sort_order
FROM public.organizations o
CROSS JOIN (VALUES
  ('Cash', 'Banknote', 'cash', 1),
  ('Card', 'CreditCard', 'card', 2),
  ('Mobile Money', 'Smartphone', 'mobile_money', 3),
  ('Bank Transfer', 'Building', 'bank_transfer', 4),
  ('Credit', 'Clock', 'credit', 5),
  ('POS', 'ShoppingCart', 'pos', 6)
) AS m(name, icon, mapped_type, sort_order)
ON CONFLICT (organization_id, name) DO NOTHING;
