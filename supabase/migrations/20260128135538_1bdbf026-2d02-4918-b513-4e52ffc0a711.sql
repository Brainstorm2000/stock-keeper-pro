-- First migration: Add the enum value only
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';