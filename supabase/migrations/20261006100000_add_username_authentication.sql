ALTER TABLE public.profiles
  ADD COLUMN username text;

WITH profile_names AS (
  SELECT
    p.user_id,
    trim(both '._-' FROM left(
      lower(regexp_replace(
        coalesce(nullif(split_part(coalesce(p.email, u.email, ''), '@', 1), ''), 'user'),
        '[^a-zA-Z0-9._-]+',
        '_',
        'g'
      )),
      30
    )) AS base_username
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.user_id
), normalized_names AS (
  SELECT
    user_id,
    CASE
      WHEN length(base_username) >= 3 THEN base_username
      ELSE 'user_' || left(user_id::text, 8)
    END AS username
  FROM profile_names
)
UPDATE public.profiles p
SET username = n.username
FROM normalized_names n
WHERE p.user_id = n.user_id;

WITH duplicate_usernames AS (
  SELECT
    user_id,
    username,
    row_number() OVER (PARTITION BY lower(username) ORDER BY user_id) AS duplicate_number
  FROM public.profiles
)
UPDATE public.profiles p
SET username = left(d.username, 20) || '_' || left(d.user_id::text, 8)
FROM duplicate_usernames d
WHERE p.user_id = d.user_id
  AND d.duplicate_number > 1;

CREATE OR REPLACE FUNCTION public.assign_profile_username()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  source_email text;
  base_username text;
BEGIN
  IF NEW.username IS NOT NULL AND btrim(NEW.username) <> '' THEN
    NEW.username := lower(btrim(NEW.username));
    RETURN NEW;
  END IF;

  SELECT coalesce(nullif(u.raw_user_meta_data->>'username', ''), NEW.email, u.email)
    INTO source_email
    FROM auth.users u
   WHERE u.id = NEW.user_id;

  base_username := trim(both '._-' FROM left(
    lower(regexp_replace(coalesce(nullif(split_part(source_email, '@', 1), ''), 'user'), '[^a-zA-Z0-9._-]+', '_', 'g')),
    30
  ));
  IF length(base_username) < 3 THEN
    base_username := 'user_' || left(NEW.user_id::text, 8);
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.user_id <> NEW.user_id
      AND lower(p.username) = lower(base_username)
  ) THEN
    base_username := left(base_username, 20) || '_' || left(NEW.user_id::text, 8);
  END IF;

  NEW.username := base_username;
  RETURN NEW;
END;
$$;

CREATE TRIGGER assign_profile_username_before_write
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_profile_username();

ALTER TABLE public.profiles
  ALTER COLUMN username SET NOT NULL,
  ADD CONSTRAINT profiles_username_format_check
    CHECK (username ~ '^[a-z0-9][a-z0-9._-]{2,29}$');

CREATE UNIQUE INDEX profiles_username_lower_unique
  ON public.profiles (lower(username));