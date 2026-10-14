-- 14 Oct 2026, phase 2 of the queued organizations access fixes. Run only
-- AFTER the frontend that reads srg1_annual_revenue_ngn and
-- subscription_status from organization_private is live; a select that names a
-- revoked column fails as a whole.
-- Owners, members and admins read these through organization_private (srg1,
-- status). runway, funding_ask and signup_source are written at onboarding and
-- only read server-side.
revoke select (srg1_annual_revenue_ngn, subscription_status, runway, funding_ask, signup_source)
  on public.organizations from anon, authenticated;
