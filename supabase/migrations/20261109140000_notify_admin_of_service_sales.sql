CREATE OR REPLACE FUNCTION public.notify_org_admin_of_service_sale()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_organization_id uuid;
  v_actor_id uuid;
  actor_username text;
  service_name text;
  notification_action text;
  admin_id uuid;
BEGIN
  SELECT s.organization_id, COALESCE(auth.uid(), s.created_by), p.name
  INTO v_organization_id, v_actor_id, service_name
  FROM public.sales s
  JOIN public.products p ON p.id = NEW.product_id
  WHERE s.id = NEW.sale_id
    AND p.item_type::text = 'service';

  IF v_organization_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(NULLIF(profile.username, ''), profile.email, 'Unknown user')
  INTO actor_username
  FROM public.profiles profile
  WHERE profile.user_id = v_actor_id;
  actor_username := COALESCE(actor_username, 'Unknown user');

  notification_action := 'Sold service ' || COALESCE(service_name, 'item')
    || ' | Qty: ' || trim_scale(abs(NEW.quantity))::text
    || CASE
      WHEN NEW.unit_price > 0 THEN ' | Unit price: ₦' || to_char(NEW.unit_price, 'FM999,999,999,990.00')
      ELSE ''
    END
    || CASE
      WHEN NEW.total_price > 0 THEN ' | Total: ₦' || to_char(NEW.total_price, 'FM999,999,999,990.00')
      ELSE ''
    END;

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

  RETURN NEW;
END;
$function$;

CREATE TRIGGER notify_org_admin_of_service_sale
AFTER INSERT ON public.sale_items
FOR EACH ROW EXECUTE FUNCTION public.notify_org_admin_of_service_sale();

REVOKE ALL ON FUNCTION public.notify_org_admin_of_service_sale() FROM PUBLIC, anon, authenticated;