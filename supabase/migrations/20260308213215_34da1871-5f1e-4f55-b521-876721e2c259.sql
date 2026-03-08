
-- Add trial and subscription date fields to organization_subscriptions
ALTER TABLE public.organization_subscriptions 
  ADD COLUMN trial_start_date timestamptz,
  ADD COLUMN trial_end_date timestamptz,
  ADD COLUMN subscription_start_date timestamptz,
  ADD COLUMN subscription_end_date timestamptz;

-- Update status column to support new statuses (trial, active, expired, suspended)
-- Current values are 'active' and 'suspended', we keep text type and just use new values

-- Update existing active subscriptions to have subscription_start_date = created_at
UPDATE public.organization_subscriptions 
SET subscription_start_date = created_at 
WHERE status = 'active' AND subscription_start_date IS NULL;
