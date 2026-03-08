
-- Add super_super_admin to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_super_admin';

-- Add is_active column to organizations
ALTER TABLE public.organizations ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
