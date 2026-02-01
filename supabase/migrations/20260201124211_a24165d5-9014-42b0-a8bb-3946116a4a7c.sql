-- Create enum for product category
CREATE TYPE public.product_category AS ENUM ('sellable', 'consumable');

-- Add category column to products table
ALTER TABLE public.products 
ADD COLUMN category public.product_category NOT NULL DEFAULT 'sellable';