-- Add split payment support to sales table
ALTER TABLE public.sales 
ADD COLUMN IF NOT EXISTS payment_details jsonb DEFAULT '[]'::jsonb;