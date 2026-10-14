-- Run in the dashboard on 14 Oct 2026 after the service_role key was found in this repo.
-- The six edge-function webhook triggers used to carry the key as a literal argument.
-- They now read it from Vault (private.get_service_role_key()) at call time.
create or replace function private.edge_webhook()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
declare
  fn text := tg_argv[0];
  request_id bigint;
begin
  select net.http_post(
    url := 'https://lzpxlnjvegpxjuexyjdj.supabase.co/functions/v1/' || fn,
    body := jsonb_build_object('old_record', old, 'record', new, 'type', tg_op,
                               'table', tg_table_name, 'schema', tg_table_schema),
    params := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json',
                                  'Authorization', 'Bearer ' || private.get_service_role_key()),
    timeout_milliseconds := 5000
  ) into request_id;
  insert into supabase_functions.hooks (hook_table_id, hook_name, request_id)
  values (tg_relid, tg_name, request_id);
  return new;
end;
$$;
revoke all on function private.edge_webhook() from public, anon, authenticated;

drop trigger if exists "notify-partner-request" on public.partner_requests;
create trigger "notify-partner-request" after insert on public.partner_requests
  for each row execute function private.edge_webhook('partner-request-notification');

drop trigger if exists "contact-notification" on public.contact_submissions;
create trigger "contact-notification" after insert on public.contact_submissions
  for each row execute function private.edge_webhook('contact-notification');

drop trigger if exists "welcome-email-on-onboarding" on public.profiles;
create trigger "welcome-email-on-onboarding" after update on public.profiles
  for each row execute function private.edge_webhook('welcome-email');

drop trigger if exists "admin-review-notification-initiative" on public.initiative_requests;
create trigger "admin-review-notification-initiative" after insert on public.initiative_requests
  for each row when (new.status = 'pending') execute function private.edge_webhook('admin-review-notification');

drop trigger if exists "admin-review-notification-org-signup" on public.organizations;
create trigger "admin-review-notification-org-signup" after insert on public.organizations
  for each row when (new.status = 'pending') execute function private.edge_webhook('admin-review-notification');

drop trigger if exists "admin-review-notification-org-verification" on public.organizations;
create trigger "admin-review-notification-org-verification" after update on public.organizations
  for each row when (new.verification_status = 'pending' and old.verification_status is distinct from 'pending')
  execute function private.edge_webhook('admin-review-notification');
