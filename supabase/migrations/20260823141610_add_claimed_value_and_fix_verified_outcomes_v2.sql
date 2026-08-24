ALTER TABLE impact_claims ADD COLUMN claimed_value text NOT NULL DEFAULT '';
ALTER TABLE impact_claims ALTER COLUMN claimed_value DROP DEFAULT;

DROP FUNCTION get_verified_outcomes_for_org(uuid);

CREATE FUNCTION public.get_verified_outcomes_for_org(p_org_id uuid)
 RETURNS TABLE(claim_id uuid, indicator_name text, claimed_value text, target_value text, status text, confirmed_at timestamp with time zone, disputed_at timestamp with time zone, dispute_reason text, partner_org_name text, mou_document_id uuid)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    ic.id,
    pi.name,
    ic.claimed_value,
    pi.target_value,
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
$function$;
