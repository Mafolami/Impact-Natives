-- Proportional due diligence + support-type routing (Oct 2026)
-- Applied by hand in the Supabase SQL editor on 20 Oct 2026 (recorded here for history).

-- 1. Settings table read by the matching functions.
create table if not exists public.matching_config (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.matching_config enable row level security;

drop policy if exists matching_config_read on public.matching_config;
create policy matching_config_read on public.matching_config
  for select to authenticated using (true);

grant select on public.matching_config to authenticated;
grant select, insert, update, delete on public.matching_config to service_role;

-- DD bar by deal-size bucket. Doc-required items only count when an
-- uploaded file exists in dd_evidence_documents under the same key.
insert into public.matching_config (key, value) values
('dd_policy', '{
  "mandatory": ["legal_registration", "safeguarding_policy", "legal_compliance_declaration"],
  "doc_required": ["legal_registration", "safeguarding_policy", "governance_doc", "audited_accounts"],
  "open_bucket": "50k_200k",
  "in_kind_bucket": "under_10k",
  "unknown_bucket": "50k_200k",
  "tiers": {
    "under_10k": { "extras": [], "pct_rule": false },
    "10k_50k":   { "extras": ["governance_doc"], "pct_rule": false },
    "50k_200k":  { "extras": [], "pct_rule": true, "pct_complete": 60 },
    "over_200k": { "extras": [], "pct_rule": true, "pct_complete": 60 }
  },
  "fdd_pct_complete": 60,
  "fdd_pct_partial": 40
}'::jsonb)
on conflict (key) do nothing;

-- Naira per US dollar. Seeded manually; update-fx-rate refreshes it daily.
insert into public.matching_config (key, value) values
('fx_ngn_per_usd', jsonb_build_object(
  'rate', 1330,
  'source', 'manual',
  'fetched_at', now(),
  'last_error', null
))
on conflict (key) do nothing;

-- 2. DD status stored with each cached match, so pages can label and sort.
alter table public.partnership_match_cache
  add column if not exists dd_status   text,
  add column if not exists dd_missing  text[],
  add column if not exists deal_bucket text;

alter table public.initiative_match_cache
  add column if not exists dd_status   text,
  add column if not exists dd_missing  text[],
  add column if not exists deal_bucket text;

-- Harmless if the tables already have table-level SELECT; needed if any
-- column-level grants are in play, so pages can read the new fields.
grant select (dd_status, dd_missing, deal_bucket) on public.partnership_match_cache to authenticated;
grant select (dd_status, dd_missing, deal_bucket) on public.initiative_match_cache to authenticated;

-- 3. Batch cache writer now carries the DD fields.
create or replace function public.upsert_partnership_listing_match_cache_batch(
  p_submitting_listing_id uuid, p_fresh_rows jsonb, p_keep_ids uuid[]
)
returns table(matches_cached integer, protected_preserved integer)
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_inserted int := 0;
  v_protected int := 0;
begin
  delete from partnership_match_cache
  where submitting_listing_id = p_submitting_listing_id
    and opening_message is null
    and not (matched_listing_id = any(coalesce(p_keep_ids, array[]::uuid[])));

  with upserted as (
    insert into partnership_match_cache (
      org_id, matched_org_id, submitting_listing_id, matched_listing_id,
      fit_score, rationale, key_synergy, criteria, criteria_version, computed_at,
      dd_status, dd_missing, deal_bucket
    )
    select
      (r->>'org_id')::uuid,
      (r->>'matched_org_id')::uuid,
      p_submitting_listing_id,
      (r->>'matched_listing_id')::uuid,
      (r->>'fit_score')::int,
      r->>'rationale',
      r->>'key_synergy',
      r->'criteria',
      (r->>'criteria_version')::int,
      now(),
      r->>'dd_status',
      case when jsonb_typeof(r->'dd_missing') = 'array'
           then array(select jsonb_array_elements_text(r->'dd_missing'))
           else null end,
      r->>'deal_bucket'
    from jsonb_array_elements(coalesce(p_fresh_rows, '[]'::jsonb)) r
    on conflict (submitting_listing_id, matched_listing_id) do update set
      org_id            = excluded.org_id,
      matched_org_id    = excluded.matched_org_id,
      fit_score         = excluded.fit_score,
      rationale         = excluded.rationale,
      key_synergy       = excluded.key_synergy,
      criteria          = excluded.criteria,
      criteria_version  = excluded.criteria_version,
      computed_at       = excluded.computed_at,
      dd_status         = excluded.dd_status,
      dd_missing        = excluded.dd_missing,
      deal_bucket       = excluded.deal_bucket
    where partnership_match_cache.opening_message is null
    returning 1
  )
  select count(*) into v_inserted from upserted;

  select count(*) into v_protected
  from partnership_match_cache
  where submitting_listing_id = p_submitting_listing_id and opening_message is not null;

  return query select v_inserted, v_protected;
end;
$function$;
