ALTER TABLE public.profiles
  ADD COLUMN subscription_tier text NOT NULL DEFAULT 'free',
  ADD COLUMN subscription_status text NOT NULL DEFAULT 'inactive',
  ADD COLUMN subscription_provider text,
  ADD COLUMN subscription_customer_id text,
  ADD COLUMN subscription_current_period_end timestamptz;
