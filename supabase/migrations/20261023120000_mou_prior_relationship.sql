-- 23 Oct 2026: "Had you worked with this partner before?" on MoU send.
-- Org A (the organisation formalising the partnership) must answer Yes/No
-- before its MoU leaves draft. Stored in its own table rather than a
-- mou_documents column because org B can read and update every column of
-- mou_documents once it leaves draft. Not used in matching, not shown
-- publicly. Reported via partnership_prior_relationship_report.
-- Applied by hand in the Supabase SQL editor on 23 Oct 2026 (recorded here
-- for history; not in the live migration history).

-- 1. Answer table, one row per MoU.
create table if not exists public.mou_prior_relationship (
  mou_document_id uuid primary key references public.mou_documents(id) on delete cascade,
  org_id          uuid references public.organizations(id) on delete set null,
  worked_before   boolean not null,
  answered_by     uuid not null,
  answered_at     timestamptz not null default now()
);

alter table public.mou_prior_relationship enable row level security;

-- Caller is org A's owner or an active member for this MoU.
create or replace function public.is_mou_org_a(p_document_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
      from mou_documents d
      join organizations o on o.id = d.org_a_id
     where d.id = p_document_id
       and (o.user_id = auth.uid() or public.is_org_member(d.org_a_id))
  );
$$;
revoke execute on function public.is_mou_org_a(uuid) from public, anon;
grant execute on function public.is_mou_org_a(uuid) to authenticated;

-- Read: org A and admins only. Org B never sees it.
drop policy if exists mou_prior_relationship_select on public.mou_prior_relationship;
create policy mou_prior_relationship_select on public.mou_prior_relationship
  for select to authenticated
  using (public.is_admin() or public.is_mou_org_a(mou_document_id));

-- No direct writes from the browser. Writes go through the RPC below.
revoke all on public.mou_prior_relationship from public, anon, authenticated;
grant select on public.mou_prior_relationship to authenticated;
grant select, insert, update, delete on public.mou_prior_relationship to service_role;

-- 2. Write path: org A, while the MoU is still a draft.
create or replace function public.set_mou_prior_relationship(p_document_id uuid, p_worked_before boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_org_a_id uuid; v_status text;
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  if p_worked_before is null then raise exception 'An answer is required'; end if;

  select org_a_id, status into v_org_a_id, v_status from mou_documents where id = p_document_id;
  if v_org_a_id is null then raise exception 'MoU not found'; end if;
  if not public.is_mou_org_a(p_document_id) then raise exception 'Not authorized for this MoU'; end if;
  if v_status <> 'draft' then raise exception 'This answer can only be changed while the MoU is a draft'; end if;

  insert into mou_prior_relationship (mou_document_id, org_id, worked_before, answered_by, answered_at)
  values (p_document_id, v_org_a_id, p_worked_before, auth.uid(), now())
  on conflict (mou_document_id) do update set
    org_id        = excluded.org_id,
    worked_before = excluded.worked_before,
    answered_by   = excluded.answered_by,
    answered_at   = excluded.answered_at;
end; $$;
revoke execute on function public.set_mou_prior_relationship(uuid, boolean) from public, anon;
grant execute on function public.set_mou_prior_relationship(uuid, boolean) to authenticated;

-- 3. Required: an MoU can't leave draft without an answer, and can't be
-- created already past draft (which would skip the question). Existing
-- non-draft MoUs are untouched.
create or replace function public.enforce_prior_relationship_before_send()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' and new.status <> 'draft' then
    raise exception 'A new MoU must start as a draft.';
  end if;
  if tg_op = 'UPDATE' and old.status = 'draft' and new.status <> 'draft' then
    if not exists (select 1 from mou_prior_relationship where mou_document_id = new.id) then
      raise exception 'Please answer "Had you worked with this partner before?" before sending this MoU.';
    end if;
  end if;
  return new;
end; $$;
revoke execute on function public.enforce_prior_relationship_before_send() from public, anon, authenticated;

drop trigger if exists trg_enforce_prior_relationship_before_send on public.mou_documents;
create trigger trg_enforce_prior_relationship_before_send
  before insert or update on public.mou_documents
  for each row execute function public.enforce_prior_relationship_before_send();

-- 4. Reporting. Read from the SQL editor (or service role). Not exposed to
-- browser roles; an admin page would need an admin-checked RPC.
-- "Partnerships with no prior relationship":
--   select * from partnership_prior_relationship_report
--    where prior_relationship = 'no' and status = 'fully_executed';
-- MoUs that left draft before this question existed show 'not_asked'.
create or replace view public.partnership_prior_relationship_report
with (security_invoker = true) as
select
  d.id                 as mou_document_id,
  d.status,
  d.created_at,
  d.fully_executed_at,
  case when d.initiative_id is not null then 'initiative'
       when d.connection_id is not null then 'direct'
  end                  as partnership_kind,
  d.initiative_id,
  d.connection_id,
  d.org_a_id,
  oa.organisation_name as org_a_name,
  d.org_b_id,
  ob.organisation_name as org_b_name,
  case when r.mou_document_id is null then 'not_asked'
       when r.worked_before then 'yes'
       else 'no'
  end                  as prior_relationship,
  r.answered_at
from public.mou_documents d
left join public.mou_prior_relationship r on r.mou_document_id = d.id
left join public.organizations oa on oa.id = d.org_a_id
left join public.organizations ob on ob.id = d.org_b_id;

revoke all on public.partnership_prior_relationship_report from public, anon, authenticated;
grant select on public.partnership_prior_relationship_report to service_role;
