-- Offline sale numbers contain a millisecond timestamp and must not be
-- included in the numeric INV sequence.
CREATE OR REPLACE FUNCTION public.generate_sale_number(org_id uuid)
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $function$
DECLARE
  next_num bigint;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('sale_number:' || org_id::text));

  SELECT COALESCE(MAX(CAST(SUBSTRING(sale_number FROM 5) AS bigint)), 0) + 1
  INTO next_num
  FROM public.sales
  WHERE organization_id = org_id
    AND sale_number ~ '^INV-[0-9]+$';

  RETURN 'INV-' || LPAD(next_num::text, 5, '0');
END;
$function$;