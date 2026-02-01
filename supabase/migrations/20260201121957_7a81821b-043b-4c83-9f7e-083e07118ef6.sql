-- Create enum for item types (products vs services)
CREATE TYPE public.item_type AS ENUM ('product', 'service');

-- Create enum for payment methods
CREATE TYPE public.payment_method AS ENUM ('cash', 'card', 'mobile_money', 'bank_transfer', 'credit');

-- Create enum for sale status
CREATE TYPE public.sale_status AS ENUM ('pending', 'completed', 'cancelled', 'on_hold');

-- Add new columns to products table for item type and pricing
ALTER TABLE public.products 
ADD COLUMN item_type public.item_type NOT NULL DEFAULT 'product',
ADD COLUMN cost_price numeric NOT NULL DEFAULT 0,
ADD COLUMN selling_price numeric NOT NULL DEFAULT 0;

-- Create expense categories table
CREATE TABLE public.expense_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(organization_id, name)
);

-- Enable RLS on expense_categories
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;

-- Expense categories policies
CREATE POLICY "Users can view expense categories in their org" 
ON public.expense_categories 
FOR SELECT 
USING (is_same_organization(auth.uid(), organization_id));

CREATE POLICY "Admins can manage expense categories" 
ON public.expense_categories 
FOR ALL 
USING (is_same_organization(auth.uid(), organization_id) AND (is_super_admin(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role)))
WITH CHECK (is_same_organization(auth.uid(), organization_id) AND (is_super_admin(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role)));

-- Create expenses table
CREATE TABLE public.expenses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id),
  category_id uuid REFERENCES public.expense_categories(id),
  amount numeric NOT NULL,
  description text NOT NULL,
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  receipt_url text,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on expenses
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

-- Expenses policies
CREATE POLICY "Users can view expenses in their org" 
ON public.expenses 
FOR SELECT 
USING (is_same_organization(auth.uid(), organization_id) AND (is_super_admin(auth.uid()) OR branch_id IS NULL OR has_branch_access(auth.uid(), branch_id)));

CREATE POLICY "Admins can manage expenses" 
ON public.expenses 
FOR ALL 
USING (is_same_organization(auth.uid(), organization_id) AND (is_super_admin(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role)))
WITH CHECK (is_same_organization(auth.uid(), organization_id) AND (is_super_admin(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role)));

-- Create sales table
CREATE TABLE public.sales (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id),
  sale_number text NOT NULL,
  customer_name text,
  customer_phone text,
  subtotal numeric NOT NULL DEFAULT 0,
  discount_amount numeric NOT NULL DEFAULT 0,
  discount_percent numeric NOT NULL DEFAULT 0,
  tax_amount numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  payment_method public.payment_method NOT NULL DEFAULT 'cash',
  status public.sale_status NOT NULL DEFAULT 'completed',
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on sales
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

-- Sales policies
CREATE POLICY "Users can view sales in their org" 
ON public.sales 
FOR SELECT 
USING (is_same_organization(auth.uid(), organization_id) AND (is_super_admin(auth.uid()) OR branch_id IS NULL OR has_branch_access(auth.uid(), branch_id)));

CREATE POLICY "Admins can manage sales" 
ON public.sales 
FOR ALL 
USING (is_same_organization(auth.uid(), organization_id) AND (is_super_admin(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role)))
WITH CHECK (is_same_organization(auth.uid(), organization_id) AND (is_super_admin(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role)));

-- Create sale items table
CREATE TABLE public.sale_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sale_id uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id),
  quantity numeric NOT NULL,
  unit_price numeric NOT NULL,
  cost_price numeric NOT NULL DEFAULT 0,
  discount_amount numeric NOT NULL DEFAULT 0,
  total_price numeric NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on sale_items
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;

-- Sale items policies (inherit from parent sale)
CREATE POLICY "Users can view sale items for accessible sales" 
ON public.sale_items 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM public.sales s 
  WHERE s.id = sale_items.sale_id 
  AND is_same_organization(auth.uid(), s.organization_id)
  AND (is_super_admin(auth.uid()) OR s.branch_id IS NULL OR has_branch_access(auth.uid(), s.branch_id))
));

CREATE POLICY "Admins can manage sale items" 
ON public.sale_items 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM public.sales s 
  WHERE s.id = sale_items.sale_id 
  AND is_same_organization(auth.uid(), s.organization_id)
  AND (is_super_admin(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.sales s 
  WHERE s.id = sale_items.sale_id 
  AND is_same_organization(auth.uid(), s.organization_id)
  AND (is_super_admin(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role))
));

-- Create held orders table (for POS hold functionality)
CREATE TABLE public.held_orders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES public.branches(id),
  customer_name text,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on held_orders
ALTER TABLE public.held_orders ENABLE ROW LEVEL SECURITY;

-- Held orders policies
CREATE POLICY "Users can view held orders in their org" 
ON public.held_orders 
FOR SELECT 
USING (is_same_organization(auth.uid(), organization_id) AND (is_super_admin(auth.uid()) OR branch_id IS NULL OR has_branch_access(auth.uid(), branch_id)));

CREATE POLICY "Admins can manage held orders" 
ON public.held_orders 
FOR ALL 
USING (is_same_organization(auth.uid(), organization_id) AND (is_super_admin(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role)))
WITH CHECK (is_same_organization(auth.uid(), organization_id) AND (is_super_admin(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role)));

-- Create storage bucket for expense receipts
INSERT INTO storage.buckets (id, name, public) VALUES ('expense-receipts', 'expense-receipts', false);

-- Storage policies for expense receipts
CREATE POLICY "Users can view expense receipts in their org" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'expense-receipts' AND auth.uid() IS NOT NULL);

CREATE POLICY "Admins can upload expense receipts" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'expense-receipts' AND auth.uid() IS NOT NULL);

CREATE POLICY "Admins can update expense receipts" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'expense-receipts' AND auth.uid() IS NOT NULL);

CREATE POLICY "Admins can delete expense receipts" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'expense-receipts' AND auth.uid() IS NOT NULL);

-- Create function to generate sale numbers
CREATE OR REPLACE FUNCTION public.generate_sale_number(org_id uuid)
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  next_num integer;
  sale_prefix text;
BEGIN
  -- Get the next sale number for this organization
  SELECT COALESCE(MAX(CAST(SUBSTRING(sale_number FROM 5) AS integer)), 0) + 1
  INTO next_num
  FROM public.sales
  WHERE organization_id = org_id;
  
  -- Format as INV-00001
  RETURN 'INV-' || LPAD(next_num::text, 5, '0');
END;
$$;

-- Create triggers for updated_at
CREATE TRIGGER update_expense_categories_updated_at
BEFORE UPDATE ON public.expense_categories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_expenses_updated_at
BEFORE UPDATE ON public.expenses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sales_updated_at
BEFORE UPDATE ON public.sales
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for sales
ALTER PUBLICATION supabase_realtime ADD TABLE public.sales;
ALTER PUBLICATION supabase_realtime ADD TABLE public.expenses;