CREATE OR REPLACE FUNCTION public.prevent_duplicate_customer_contacts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'UPDATE'
    AND NEW.organization_id IS NOT DISTINCT FROM OLD.organization_id
    AND NEW.email IS NOT DISTINCT FROM OLD.email
    AND NEW.phone IS NOT DISTINCT FROM OLD.phone
  THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      NEW.organization_id::text || ':' || COALESCE(NEW.branch_id::text, 'unassigned'),
      0
    )
  );

  IF NULLIF(btrim(NEW.email), '') IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.customers existing
      WHERE existing.organization_id = NEW.organization_id
        AND existing.branch_id IS NOT DISTINCT FROM NEW.branch_id
        AND existing.id <> NEW.id
        AND lower(btrim(existing.email)) = lower(btrim(NEW.email))
    )
  THEN
    RAISE EXCEPTION USING
      ERRCODE = '23505',
      CONSTRAINT = 'customers_organization_email_unique',
      MESSAGE = 'A customer with this email already exists in this organization.';
  END IF;

  IF NULLIF(regexp_replace(NEW.phone, '[^0-9]', '', 'g'), '') IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.customers existing
      WHERE existing.organization_id = NEW.organization_id
        AND existing.branch_id IS NOT DISTINCT FROM NEW.branch_id
        AND existing.id <> NEW.id
        AND NULLIF(regexp_replace(existing.phone, '[^0-9]', '', 'g'), '')
          = regexp_replace(NEW.phone, '[^0-9]', '', 'g')
    )
  THEN
    RAISE EXCEPTION USING
      ERRCODE = '23505',
      CONSTRAINT = 'customers_organization_phone_unique',
      MESSAGE = 'A customer with this phone number already exists in this organization.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER prevent_duplicate_customer_contacts
BEFORE INSERT OR UPDATE OF organization_id, branch_id, email, phone
ON public.customers
FOR EACH ROW
EXECUTE FUNCTION public.prevent_duplicate_customer_contacts();
