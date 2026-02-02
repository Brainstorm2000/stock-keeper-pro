-- Make branch_id NOT NULL on products table
ALTER TABLE public.products 
ALTER COLUMN branch_id SET NOT NULL;