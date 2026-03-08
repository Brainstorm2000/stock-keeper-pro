
-- Update has_active_subscription to also allow 'lifetime' status
CREATE OR REPLACE FUNCTION public.has_active_subscription(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_subscriptions os
    JOIN public.profiles p ON p.organization_id = os.organization_id
    WHERE p.user_id = _user_id
      AND (
        -- Lifetime never expires
        os.status = 'lifetime'
        OR
        (os.status = 'trial' AND (os.trial_end_date IS NULL OR os.trial_end_date > now()))
        OR
        (os.status = 'active' AND (os.subscription_end_date IS NULL OR os.subscription_end_date > now()))
      )
  )
  OR public.is_super_super_admin(_user_id)
$$;
