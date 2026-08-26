-- Critical security fix: profiles previously granted UPDATE at the table
-- level to `authenticated`, with no column restriction. Combined with the
-- "Users can update own profile" RLS policy (auth.uid() = id, no column
-- check), this meant any logged-in user could self-grant admin rights
-- (is_admin), mark themselves verified (is_verified/is_active), or --
-- following this session's earlier migration adding subscription columns
-- to profiles -- self-grant a paid tier without payment. This was
-- discovered while locking down the new subscription_* columns and fixed
-- in the same pass, mirroring the existing protection already in place on
-- organizations.subscription_*.
REVOKE UPDATE ON public.profiles FROM authenticated;

GRANT UPDATE (
  avatar_url,
  bio,
  country,
  email,
  feed_visibility,
  full_name,
  linkedin_url,
  notification_preferences,
  onboarding_completed,
  org_name,
  org_type,
  phone,
  role_title,
  sectors,
  show_individual_profile,
  social_links,
  user_type,
  verification_requested,
  website
) ON public.profiles TO authenticated;
