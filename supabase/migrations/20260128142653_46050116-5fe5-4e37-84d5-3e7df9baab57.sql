-- Drop existing restrictive policies on units table
DROP POLICY IF EXISTS "Admins can insert units" ON public.units;
DROP POLICY IF EXISTS "Admins can update units" ON public.units;
DROP POLICY IF EXISTS "Admins can delete units" ON public.units;

-- Create new policies that include super_admin
CREATE POLICY "Admins and super admins can insert units" 
ON public.units 
FOR INSERT 
WITH CHECK (is_super_admin(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins and super admins can update units" 
ON public.units 
FOR UPDATE 
USING (is_super_admin(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins and super admins can delete units" 
ON public.units 
FOR DELETE 
USING (is_super_admin(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));

-- Fix stock_history table as well (same issue)
DROP POLICY IF EXISTS "Admins can insert stock history" ON public.stock_history;

CREATE POLICY "Admins and super admins can insert stock history" 
ON public.stock_history 
FOR INSERT 
WITH CHECK (is_super_admin(auth.uid()) OR has_role(auth.uid(), 'admin'::app_role));