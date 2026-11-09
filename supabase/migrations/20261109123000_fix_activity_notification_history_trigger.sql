CREATE OR REPLACE FUNCTION public.notify_org_admin_of_history_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  resource_id uuid;
  v_actor_id uuid;
  actor_username text;
  v_organization_id uuid;
  item_name text;
  history_change_type text;
  notification_action text;
  admin_id uuid;
BEGIN
  IF TG_TABLE_NAME = 'stock_history' THEN
    IF TG_OP = 'DELETE' THEN
      resource_id := OLD.product_id;
      v_actor_id := COALESCE(auth.uid(), OLD.changed_by);
      history_change_type := OLD.change_type;
    ELSE
      resource_id := NEW.product_id;
      v_actor_id := COALESCE(auth.uid(), NEW.changed_by);
      history_change_type := NEW.change_type;
    END IF;

    SELECT p.organization_id, p.name
    INTO v_organization_id, item_name
    FROM public.products p
    WHERE p.id = resource_id;
  ELSE
    IF TG_OP = 'DELETE' THEN
      resource_id := OLD.raw_material_id;
      v_actor_id := COALESCE(auth.uid(), OLD.changed_by);
      history_change_type := OLD.change_type;
    ELSE
      resource_id := NEW.raw_material_id;
      v_actor_id := COALESCE(auth.uid(), NEW.changed_by);
      history_change_type := NEW.change_type;
    END IF;

    SELECT rm.organization_id, rm.name
    INTO v_organization_id, item_name
    FROM public.raw_materials rm
    WHERE rm.id = resource_id;
  END IF;

  IF v_organization_id IS NULL THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  SELECT COALESCE(NULLIF(p.username, ''), p.email, 'Unknown user')
  INTO actor_username
  FROM public.profiles p
  WHERE p.user_id = v_actor_id;
  actor_username := COALESCE(actor_username, 'Unknown user');

  notification_action := CASE TG_OP
    WHEN 'INSERT' THEN 'Recorded '
    WHEN 'UPDATE' THEN 'Updated '
    ELSE 'Deleted '
  END || INITCAP(REPLACE(COALESCE(history_change_type, 'stock'), '_', ' '))
    || CASE WHEN TG_OP = 'INSERT' THEN ' for ' ELSE ' history for ' END
    || COALESCE(item_name, 'item');

  FOR admin_id IN
    SELECT ur.user_id
    FROM public.user_roles ur
    WHERE ur.organization_id = v_organization_id
      AND ur.role = 'super_admin'::public.app_role
  LOOP
    INSERT INTO public.activity_notifications (
      recipient_id,
      organization_id,
      actor_id,
      actor_username,
      action
    )
    VALUES (
      admin_id,
      v_organization_id,
      v_actor_id,
      actor_username,
      notification_action
    );
  END LOOP;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$function$;