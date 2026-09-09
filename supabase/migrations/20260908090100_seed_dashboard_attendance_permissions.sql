-- Existing staff permissions should continue to cover attendance until it is configured separately.
INSERT INTO public.role_module_permissions (
  organization_id,
  role,
  module,
  can_view,
  can_create,
  can_edit,
  can_delete
)
SELECT
  organization_id,
  role,
  'attendance'::public.app_module,
  can_view,
  can_create,
  can_edit,
  can_delete
FROM public.role_module_permissions
WHERE module = 'staff'::public.app_module
ON CONFLICT (organization_id, role, module) DO NOTHING;

-- Dashboard is viewable by default; its dashboard financial section remains separately restricted.
INSERT INTO public.role_module_permissions (
  organization_id,
  role,
  module,
  can_view,
  can_create,
  can_edit,
  can_delete
)
SELECT DISTINCT
  organizations.id,
  roles.role,
  'dashboard'::public.app_module,
  true,
  false,
  false,
  false
FROM public.organizations
CROSS JOIN (VALUES
  ('admin'::public.app_role),
  ('user'::public.app_role)
) AS roles(role)
ON CONFLICT (organization_id, role, module) DO NOTHING;