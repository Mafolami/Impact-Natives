-- Cache table for AI-scored org-to-org partnership matches, backing the
-- 12-hour lazy-refresh pattern in the refresh-partnership-matches edge
-- function. Read-only for authenticated (their own org's rows only);
-- writes only ever happen via the service role from that function.

create table public.partnership_match_cache (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  matched_org_id uuid not null references public.organizations(id) on delete cascade,
  fit_score integer not null,
  rationale text not null,
  key_synergy text,
  computed_at timestamptz not null default now(),
  unique (org_id, matched_org_id)
);

create index partnership_match_cache_org_score_idx
  on public.partnership_match_cache (org_id, fit_score desc);

alter table public.partnership_match_cache enable row level security;

create policy "Org owners can read their own partnership matches"
on public.partnership_match_cache for select
to authenticated
using (
  org_id in (select id from public.organizations where user_id = auth.uid())
);

grant select on public.partnership_match_cache to authenticated;
grant select, insert, update, delete on public.partnership_match_cache to service_role;
