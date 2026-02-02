-- Add tax fields to purchases table
ALTER TABLE public.purchases 
ADD COLUMN tax_rate numeric NOT NULL DEFAULT 0,
ADD COLUMN tax_amount numeric NOT NULL DEFAULT 0;