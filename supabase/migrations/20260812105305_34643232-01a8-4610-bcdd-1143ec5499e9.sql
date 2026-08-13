CREATE TABLE public.report_email_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  is_enabled boolean NOT NULL DEFAULT false,
  recipient_emails text[] NOT NULL DEFAULT '{}',
  subject text NOT NULL DEFAULT 'Your business report',
  reports text[] NOT NULL DEFAULT ARRAY['sales','inventory','purchases','expenses'],
  formats text[] NOT NULL DEFAULT ARRAY['excel','pdf'],
  frequency text NOT NULL DEFAULT 'weekly',
  send_time time NOT NULL DEFAULT '08:00',
  day_of_week integer NOT NULL DEFAULT 1,
  day_of_month integer NOT NULL DEFAULT 1,
  timezone text NOT NULL DEFAULT 'Africa/Lagos',
  last_sent_at timestamptz,
  next_run_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT report_email_frequency_check CHECK (frequency IN ('daily','weekly','monthly')),
  CONSTRAINT report_email_dow_check CHECK (day_of_week BETWEEN 0 AND 6),
  CONSTRAINT report_email_dom_check CHECK (day_of_month BETWEEN 1 AND 28)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_email_settings TO authenticated;
GRANT ALL ON public.report_email_settings TO service_role;
ALTER TABLE public.report_email_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org admins manage report email settings"
ON public.report_email_settings FOR ALL TO authenticated
USING (
  public.is_same_organization(auth.uid(), organization_id)
  AND (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'admin'))
  OR public.is_super_super_admin(auth.uid())
)
WITH CHECK (
  public.is_same_organization(auth.uid(), organization_id)
  AND (public.is_super_admin(auth.uid()) OR public.has_role(auth.uid(), 'admin'))
  OR public.is_super_super_admin(auth.uid())
);

CREATE TRIGGER update_report_email_settings_updated_at
BEFORE UPDATE ON public.report_email_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.report_email_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  recipients text[] NOT NULL DEFAULT '{}',
  subject text,
  period_start date,
  period_end date,
  status text NOT NULL DEFAULT 'sent',
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.report_email_log TO authenticated;
GRANT ALL ON public.report_email_log TO service_role;
ALTER TABLE public.report_email_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members view report email log"
ON public.report_email_log FOR SELECT TO authenticated
USING (
  public.is_same_organization(auth.uid(), organization_id)
  OR public.is_super_super_admin(auth.uid())
);

CREATE INDEX idx_report_email_log_org ON public.report_email_log(organization_id, created_at DESC);
CREATE INDEX idx_report_email_settings_due ON public.report_email_settings(next_run_at) WHERE is_enabled;