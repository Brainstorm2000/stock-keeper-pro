CREATE OR REPLACE FUNCTION public.set_audit_actor_from_auth()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF TG_TABLE_NAME = 'stock_history' THEN
    IF NEW.changed_by IS NULL THEN
      NEW.changed_by := auth.uid();
    END IF;
  ELSIF TG_TABLE_NAME = 'raw_material_stock_history' THEN
    IF NEW.changed_by IS NULL THEN
      NEW.changed_by := auth.uid();
    END IF;
  ELSIF TG_TABLE_NAME = 'work_orders' THEN
    IF NEW.created_by IS NULL THEN
      NEW.created_by := auth.uid();
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.set_audit_actor_from_auth() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_audit_actor_from_auth() FROM anon;
REVOKE ALL ON FUNCTION public.set_audit_actor_from_auth() FROM authenticated;