-- weekly-sector-match and monthly-activity-digest were previously invoked by
-- pg_cron using the public anon key as the bearer token — meaning anyone
-- with the anon key (shipped in every frontend bundle) could trigger a full
-- mass-notification/mass-email run outside its schedule. Both functions now
-- reject any caller that isn't the service role; this migration updates the
-- cron jobs to actually send the correct key, matching the pattern already
-- used correctly by send-newsletter (jobid 5, untouched here).
--
-- Note: this assumes jobid 1 and jobid 4 already exist in cron.job for this
-- project. It is a record of what was applied, not a portable/idempotent
-- migration for a fresh environment.

select cron.alter_job(
  job_id := 1,
  command := $$
  SELECT net.http_post(
    url := 'https://lzpxlnjvegpxjuexyjdj.supabase.co/functions/v1/weekly-sector-match',
    headers := ('{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.service_role_key') || '"}')::jsonb
  );
  $$
);

select cron.alter_job(
  job_id := 4,
  command := $$
  SELECT net.http_post(
    url := 'https://lzpxlnjvegpxjuexyjdj.supabase.co/functions/v1/monthly-activity-digest',
    headers := ('{"Content-Type": "application/json", "Authorization": "Bearer ' || current_setting('app.service_role_key') || '"}')::jsonb
  );
  $$
);

-- srg1-deadline-reminder (jobid 3) pointed at a function that no longer
-- exists in the deployed function list. Disabled rather than deleted, so
-- there's a record it was intentionally turned off, not silently lost.
select cron.alter_job(job_id := 3, active := false);
