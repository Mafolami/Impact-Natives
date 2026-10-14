-- 14 Oct 2026, phase 1 of the queued organizations access fixes (run in the
-- SQL editor). 1) Visibility hold enforced in RLS, not just client-side.
-- 2) subscription_status copied into organization_private (owner, members,
-- admins) and kept in sync, so phase 2 can revoke it from organizations.
alter policy "Anyone can read published organizations" on public.organizations
  using (status = 'published' and is_demo_org = false and not coalesce(flagged_visibility_hold, false));

alter table public.organization_private add column if not exists subscription_status text;

update public.organization_private p
   set subscription_status = o.subscription_status
  from public.organizations o
 where o.id = p.organization_id;

create or replace function public.sync_org_private()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
begin
  insert into public.organization_private
    (organization_id, email, tin, registration_number, scuml_number,
     srg1_annual_revenue_ngn, srg1_pie_self_declared, srg1_reminder_dismissed_at, dd_evidence,
     dd_financial_model_url, dd_audited_accounts_url, dd_governance_doc_url, dd_esg_assessment_url, dd_impact_framework_url,
     subscription_customer_id, subscription_authorization_code, subscription_status,
     flagged_review_status, flagged_review_notes, flagged_review_due, flagged_reviewed_at, flagged_visibility_hold)
  values
    (new.id, new.email, new.tin, new.registration_number, new.scuml_number,
     new.srg1_annual_revenue_ngn, new.srg1_pie_self_declared, new.srg1_reminder_dismissed_at, new.dd_evidence,
     new.dd_financial_model_url, new.dd_audited_accounts_url, new.dd_governance_doc_url, new.dd_esg_assessment_url, new.dd_impact_framework_url,
     new.subscription_customer_id, new.subscription_authorization_code, new.subscription_status,
     new.flagged_review_status, new.flagged_review_notes, new.flagged_review_due, new.flagged_reviewed_at, new.flagged_visibility_hold)
  on conflict (organization_id) do update set
    email = excluded.email, tin = excluded.tin,
    registration_number = excluded.registration_number, scuml_number = excluded.scuml_number,
    srg1_annual_revenue_ngn = excluded.srg1_annual_revenue_ngn,
    srg1_pie_self_declared = excluded.srg1_pie_self_declared,
    srg1_reminder_dismissed_at = excluded.srg1_reminder_dismissed_at,
    dd_evidence = excluded.dd_evidence,
    dd_financial_model_url = excluded.dd_financial_model_url,
    dd_audited_accounts_url = excluded.dd_audited_accounts_url,
    dd_governance_doc_url = excluded.dd_governance_doc_url,
    dd_esg_assessment_url = excluded.dd_esg_assessment_url,
    dd_impact_framework_url = excluded.dd_impact_framework_url,
    subscription_customer_id = excluded.subscription_customer_id,
    subscription_authorization_code = excluded.subscription_authorization_code,
    subscription_status = excluded.subscription_status,
    flagged_review_status = excluded.flagged_review_status,
    flagged_review_notes = excluded.flagged_review_notes,
    flagged_review_due = excluded.flagged_review_due,
    flagged_reviewed_at = excluded.flagged_reviewed_at,
    flagged_visibility_hold = excluded.flagged_visibility_hold,
    updated_at = now();
  return new;
end;
$function$;
revoke execute on function public.sync_org_private() from public, anon, authenticated;

drop trigger if exists trg_sync_org_private on public.organizations;
create trigger trg_sync_org_private
  after insert or update of email, tin, registration_number, scuml_number, srg1_annual_revenue_ngn,
    srg1_pie_self_declared, srg1_reminder_dismissed_at, dd_evidence, dd_financial_model_url,
    dd_audited_accounts_url, dd_governance_doc_url, dd_esg_assessment_url, dd_impact_framework_url,
    subscription_customer_id, subscription_authorization_code, subscription_status,
    flagged_review_status, flagged_review_notes, flagged_review_due, flagged_reviewed_at, flagged_visibility_hold
  on public.organizations for each row execute function public.sync_org_private();
