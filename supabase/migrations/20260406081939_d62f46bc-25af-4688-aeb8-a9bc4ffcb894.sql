
-- Add CRUD boolean columns to role_module_permissions
ALTER TABLE public.role_module_permissions 
  ADD COLUMN can_view boolean NOT NULL DEFAULT false,
  ADD COLUMN can_create boolean NOT NULL DEFAULT false,
  ADD COLUMN can_edit boolean NOT NULL DEFAULT false,
  ADD COLUMN can_delete boolean NOT NULL DEFAULT false;

-- Migrate existing data in role_module_permissions
UPDATE public.role_module_permissions SET
  can_view = CASE WHEN access_level IN ('view', 'create', 'full') THEN true ELSE false END,
  can_create = CASE WHEN access_level IN ('create', 'full') THEN true ELSE false END,
  can_edit = CASE WHEN access_level = 'full' THEN true ELSE false END,
  can_delete = CASE WHEN access_level = 'full' THEN true ELSE false END;

-- Drop old column
ALTER TABLE public.role_module_permissions DROP COLUMN access_level;

-- Check if user_module_permissions table exists and update it
ALTER TABLE public.user_module_permissions 
  ADD COLUMN can_view boolean NOT NULL DEFAULT false,
  ADD COLUMN can_create boolean NOT NULL DEFAULT false,
  ADD COLUMN can_edit boolean NOT NULL DEFAULT false,
  ADD COLUMN can_delete boolean NOT NULL DEFAULT false;

-- Migrate existing data in user_module_permissions
UPDATE public.user_module_permissions SET
  can_view = CASE WHEN access_level IN ('view', 'create', 'full') THEN true ELSE false END,
  can_create = CASE WHEN access_level IN ('create', 'full') THEN true ELSE false END,
  can_edit = CASE WHEN access_level = 'full' THEN true ELSE false END,
  can_delete = CASE WHEN access_level = 'full' THEN true ELSE false END;

-- Drop old column
ALTER TABLE public.user_module_permissions DROP COLUMN access_level;

-- Update get_module_access to return a composite instead — we'll use a new approach
-- Drop old functions that reference the old enum
DROP FUNCTION IF EXISTS public.get_module_access(_user_id uuid, _module app_module);
DROP FUNCTION IF EXISTS public.has_module_access(_user_id uuid, _module app_module, _min_level module_access_level);

-- Create new helper functions for CRUD checks
CREATE OR REPLACE FUNCTION public.has_module_permission(_user_id uuid, _module app_module, _permission text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    CASE WHEN is_super_admin(_user_id) THEN true
    ELSE COALESCE(
      -- Check user-specific override first
      (SELECT 
        CASE _permission
          WHEN 'view' THEN ump.can_view
          WHEN 'create' THEN ump.can_create
          WHEN 'edit' THEN ump.can_edit
          WHEN 'delete' THEN ump.can_delete
          ELSE false
        END
       FROM public.user_module_permissions ump
       WHERE ump.user_id = _user_id AND ump.module = _module),
      -- Fall back to role-based permission
      (SELECT 
        CASE _permission
          WHEN 'view' THEN rmp.can_view
          WHEN 'create' THEN rmp.can_create
          WHEN 'edit' THEN rmp.can_edit
          WHEN 'delete' THEN rmp.can_delete
          ELSE false
        END
       FROM public.role_module_permissions rmp
       JOIN public.profiles p ON p.organization_id = rmp.organization_id
       JOIN public.user_roles ur ON ur.user_id = p.user_id AND ur.role = rmp.role
       WHERE p.user_id = _user_id AND rmp.module = _module),
      -- Default
      false
    )
    END
$$;

-- Drop the old enum type if no longer referenced
-- We can't drop it if other things reference it, so leave it for now
