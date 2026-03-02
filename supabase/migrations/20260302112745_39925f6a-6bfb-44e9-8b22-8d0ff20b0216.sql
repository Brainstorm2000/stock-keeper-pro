
-- Add 'production' to app_module enum
ALTER TYPE public.app_module ADD VALUE IF NOT EXISTS 'production';

-- Create production_tables
CREATE TABLE public.production_tables (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.production_tables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage production tables"
ON public.production_tables FOR ALL
USING (
  is_same_organization(auth.uid(), organization_id)
  AND (is_super_admin(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))
)
WITH CHECK (
  is_same_organization(auth.uid(), organization_id)
  AND (is_super_admin(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))
);

CREATE POLICY "Users can view production tables in their org"
ON public.production_tables FOR SELECT
USING (is_same_organization(auth.uid(), organization_id));

-- Create production_fields
CREATE TABLE public.production_fields (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  table_id UUID NOT NULL REFERENCES public.production_tables(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('text', 'number', 'currency', 'date', 'boolean', 'select')),
  required BOOLEAN NOT NULL DEFAULT false,
  options JSONB DEFAULT '[]'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.production_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage production fields"
ON public.production_fields FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.production_tables pt
    WHERE pt.id = production_fields.table_id
    AND is_same_organization(auth.uid(), pt.organization_id)
    AND (is_super_admin(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.production_tables pt
    WHERE pt.id = production_fields.table_id
    AND is_same_organization(auth.uid(), pt.organization_id)
    AND (is_super_admin(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))
  )
);

CREATE POLICY "Users can view production fields in their org"
ON public.production_fields FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.production_tables pt
    WHERE pt.id = production_fields.table_id
    AND is_same_organization(auth.uid(), organization_id)
  )
);

-- Create production_records
CREATE TABLE public.production_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  table_id UUID NOT NULL REFERENCES public.production_tables(id) ON DELETE CASCADE,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.production_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage production records"
ON public.production_records FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.production_tables pt
    WHERE pt.id = production_records.table_id
    AND is_same_organization(auth.uid(), pt.organization_id)
    AND (is_super_admin(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.production_tables pt
    WHERE pt.id = production_records.table_id
    AND is_same_organization(auth.uid(), pt.organization_id)
    AND (is_super_admin(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))
  )
);

CREATE POLICY "Users can view production records in their org"
ON public.production_records FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.production_tables pt
    WHERE pt.id = production_records.table_id
    AND is_same_organization(auth.uid(), pt.organization_id)
  )
);

-- Create production_record_values
CREATE TABLE public.production_record_values (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  record_id UUID NOT NULL REFERENCES public.production_records(id) ON DELETE CASCADE,
  field_id UUID NOT NULL REFERENCES public.production_fields(id) ON DELETE CASCADE,
  value TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.production_record_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage production record values"
ON public.production_record_values FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.production_records pr
    JOIN public.production_tables pt ON pt.id = pr.table_id
    WHERE pr.id = production_record_values.record_id
    AND is_same_organization(auth.uid(), pt.organization_id)
    AND (is_super_admin(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.production_records pr
    JOIN public.production_tables pt ON pt.id = pr.table_id
    WHERE pr.id = production_record_values.record_id
    AND is_same_organization(auth.uid(), pt.organization_id)
    AND (is_super_admin(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))
  )
);

CREATE POLICY "Users can view production record values in their org"
ON public.production_record_values FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.production_records pr
    JOIN public.production_tables pt ON pt.id = pr.table_id
    WHERE pr.id = production_record_values.record_id
    AND is_same_organization(auth.uid(), pt.organization_id)
  )
);

-- Add updated_at triggers
CREATE TRIGGER update_production_tables_updated_at
  BEFORE UPDATE ON public.production_tables
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_production_fields_updated_at
  BEFORE UPDATE ON public.production_fields
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
