create or replace function get_verified_outcomes_for_org(p_org_id uuid)
returns table (
  claim_id uuid,
  indicator_name text,
  claim_text text,
  indicator_value text,
  status text,
  confirmed_at timestamptz,
  disputed_at timestamptz,
  dispute_reason text,
  partner_org_name text,
  mou_document_id uuid
)
language sql
security definer
set search_path = public
as $$
  select
    ic.id,
    pi.name,
    ic.claim_text,
    ic.indicator_value,
    ic.status,
    ic.confirmed_at,
    ic.disputed_at,
    ic.dispute_reason,
    partner_org.organisation_name,
    pi.mou_document_id
  from impact_claims ic
  join partnership_indicators pi on pi.id = ic.indicator_id
  join mou_documents md on md.id = pi.mou_document_id
  join organizations partner_org on partner_org.id = (
    case when ic.claiming_org_id = md.org_a_id then md.org_b_id else md.org_a_id end
  )
  where ic.claiming_org_id = p_org_id
    and (ic.status = 'confirmed' or (ic.status = 'disputed' and ic.confirmed_at is not null));
$$;

grant execute on function get_verified_outcomes_for_org(uuid) to authenticated;
