-- Create customers table
CREATE TABLE public.customers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create suppliers table
CREATE TABLE public.suppliers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create brands table
CREATE TABLE public.brands (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add supplier_id and brand_id to products table
ALTER TABLE public.products
ADD COLUMN supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
ADD COLUMN brand_id UUID REFERENCES public.brands(id) ON DELETE SET NULL;

-- Enable RLS on all new tables
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;

-- Customers RLS policies
CREATE POLICY "Users can view customers in their org"
ON public.customers FOR SELECT
USING (is_same_organization(auth.uid(), organization_id));

CREATE POLICY "Admins can manage customers"
ON public.customers FOR ALL
USING (is_same_organization(auth.uid(), organization_id) AND (is_super_admin(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role)))
WITH CHECK (is_same_organization(auth.uid(), organization_id) AND (is_super_admin(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role)));

-- Suppliers RLS policies
CREATE POLICY "Users can view suppliers in their org"
ON public.suppliers FOR SELECT
USING (is_same_organization(auth.uid(), organization_id));

CREATE POLICY "Admins can manage suppliers"
ON public.suppliers FOR ALL
USING (is_same_organization(auth.uid(), organization_id) AND (is_super_admin(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role)))
WITH CHECK (is_same_organization(auth.uid(), organization_id) AND (is_super_admin(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role)));

-- Brands RLS policies
CREATE POLICY "Users can view brands in their org"
ON public.brands FOR SELECT
USING (is_same_organization(auth.uid(), organization_id));

CREATE POLICY "Admins can manage brands"
ON public.brands FOR ALL
USING (is_same_organization(auth.uid(), organization_id) AND (is_super_admin(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role)))
WITH CHECK (is_same_organization(auth.uid(), organization_id) AND (is_super_admin(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role)));

-- Add updated_at triggers
CREATE TRIGGER update_customers_updated_at
BEFORE UPDATE ON public.customers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_suppliers_updated_at
BEFORE UPDATE ON public.suppliers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_brands_updated_at
BEFORE UPDATE ON public.brands
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add customer_id to sales table for linking purchases
ALTER TABLE public.sales
ADD COLUMN customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL;