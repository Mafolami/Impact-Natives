-- Proportional DD follow-up: cache reset + daily FX cron.
-- Applied by hand in the Supabase SQL editor on 20 Oct 2026, after the functions were deployed.

-- 1. Invalidate cached scores so everything recomputes with the new rules.
update public.criteria_versions set version = version + 1, updated_at = now()
where match_type in ('partnership', 'initiative');

-- Clear stale rows. Bulk refreshes never overwrite "protected" partnership
-- rows (opening_message set), so without this they would keep old capped
-- scores and no DD status until someone reopens that fit analysis. Pages
-- recompute on next load; the 03:00 sweeps backfill the rest.
delete from public.partnership_match_cache pmc
using public.criteria_versions cv
where cv.match_type = 'partnership' and pmc.criteria_version < cv.version;

delete from public.initiative_match_cache imc
using public.criteria_versions cv
where cv.match_type = 'initiative' and imc.criteria_version < cv.version;

-- 2. Daily FX refresh at 02:41 Lagos-agnostic UTC, before the 03:00 sweeps.
select cron.unschedule('update-fx-rate-job')
where exists (select 1 from cron.job where jobname = 'update-fx-rate-job');

select cron.schedule(
  'update-fx-rate-job',
  '41 2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://lzpxlnjvegpxjuexyjdj.supabase.co/functions/v1/update-fx-rate',
    headers := ('{"Content-Type": "application/json", "Authorization": "Bearer ' || private.get_service_role_key() || '"}')::jsonb,
    body := '{}'::jsonb
  );
  $$
);
