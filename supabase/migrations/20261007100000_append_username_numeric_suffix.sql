CREATE OR REPLACE FUNCTION public.assign_profile_username()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  source_email text;
  base_username text;
  candidate_username text;
  suffix_number integer;
  attempts integer := 0;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.username IS NOT DISTINCT FROM OLD.username THEN
    RETURN NEW;
  END IF;

  IF NEW.username IS NULL OR btrim(NEW.username) = '' THEN
    SELECT coalesce(nullif(u.raw_user_meta_data->>'username', ''), NEW.email, u.email)
      INTO source_email
      FROM auth.users u
     WHERE u.id = NEW.user_id;
    base_username := split_part(coalesce(source_email, 'user'), '@', 1);
  ELSE
    base_username := NEW.username;
  END IF;

  base_username := regexp_replace(lower(btrim(base_username)), '-[0-9]{4}$', '');
  base_username := trim(both '._-' FROM left(
    regexp_replace(base_username, '[^a-z0-9._-]+', '_', 'g'),
    25
  ));
  IF length(base_username) < 3 THEN
    base_username := 'user_' || left(NEW.user_id::text, 8);
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(base_username, 0));

  LOOP
    suffix_number := floor(random() * 10000)::integer;
    candidate_username := base_username || '-' || lpad(suffix_number::text, 4, '0');
    EXIT WHEN NOT EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.user_id <> NEW.user_id
        AND lower(p.username) = candidate_username
    );

    attempts := attempts + 1;
    IF attempts >= 100 THEN
      RAISE EXCEPTION 'Unable to generate a unique username suffix.';
    END IF;
  END LOOP;

  NEW.username := candidate_username;
  RETURN NEW;
END;
$$;