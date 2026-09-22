ALTER TYPE public.app_module ADD VALUE IF NOT EXISTS 'tax';

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
	'tax'::public.app_module,
	can_view,
	can_create,
	can_edit,
	can_delete
FROM public.role_module_permissions
WHERE module = 'reports'::public.app_module
ON CONFLICT (organization_id, role, module) DO NOTHING;