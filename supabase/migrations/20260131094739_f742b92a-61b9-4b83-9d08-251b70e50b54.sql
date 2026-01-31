-- Add logo_url, email, and address columns to organizations table
ALTER TABLE public.organizations 
ADD COLUMN logo_url TEXT,
ADD COLUMN email TEXT,
ADD COLUMN address TEXT;