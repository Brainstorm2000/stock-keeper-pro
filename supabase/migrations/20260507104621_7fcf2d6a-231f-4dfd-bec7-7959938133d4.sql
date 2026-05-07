CREATE OR REPLACE FUNCTION public.set_audit_actor_from_auth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
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

DROP TRIGGER IF EXISTS set_stock_history_audit_actor ON public.stock_history;
CREATE TRIGGER set_stock_history_audit_actor
BEFORE INSERT ON public.stock_history
FOR EACH ROW
EXECUTE FUNCTION public.set_audit_actor_from_auth();

DROP TRIGGER IF EXISTS set_raw_material_stock_history_audit_actor ON public.raw_material_stock_history;
CREATE TRIGGER set_raw_material_stock_history_audit_actor
BEFORE INSERT ON public.raw_material_stock_history
FOR EACH ROW
EXECUTE FUNCTION public.set_audit_actor_from_auth();

DROP TRIGGER IF EXISTS set_work_orders_audit_actor ON public.work_orders;
CREATE TRIGGER set_work_orders_audit_actor
BEFORE INSERT ON public.work_orders
FOR EACH ROW
EXECUTE FUNCTION public.set_audit_actor_from_auth();