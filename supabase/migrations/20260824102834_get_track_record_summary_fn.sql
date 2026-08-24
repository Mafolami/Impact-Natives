-- Single aggregate RPC for the portfolio-level Track Record dashboard.
-- Distinct from VerifiedOutcomesSection (which shows a counterparty how
-- one org's evidence looks from the outside) -- this is an org's own
-- internal view of its evidence coverage across every executed MoU.
CREATE OR REPLACE FUNCTION public.get_track_record_summary(p_org_id uuid)
RETURNS TABLE(
  confirmed_claims integer,
  disputed_claims integer,
  total_submitted_claims integer,
  distinct_confirming_partners integer,
  agreed_indicators integer,
  evidenced_indicators integer,
  executed_mous integer,
  verified_milestones integer
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT COUNT(*) FROM impact_claims WHERE claiming_org_id = p_org_id AND status = 'confirmed')::integer,
    (SELECT COUNT(*) FROM impact_claims WHERE claiming_org_id = p_org_id AND status = 'disputed')::integer,
    (SELECT COUNT(*) FROM impact_claims WHERE claiming_org_id = p_org_id)::integer,
    (SELECT COUNT(DISTINCT confirmed_by_org_id) FROM impact_claims WHERE claiming_org_id = p_org_id AND status = 'confirmed')::integer,
    (SELECT COUNT(*) FROM partnership_indicators pi
       JOIN mou_documents md ON md.id = pi.mou_document_id
       WHERE (md.org_a_id = p_org_id OR md.org_b_id = p_org_id)
         AND md.status = 'fully_executed'
         AND pi.agreed_by_other_org_id IS NOT NULL)::integer,
    (SELECT COUNT(*) FROM partnership_indicators pi
       JOIN mou_documents md ON md.id = pi.mou_document_id
       WHERE (md.org_a_id = p_org_id OR md.org_b_id = p_org_id)
         AND md.status = 'fully_executed'
         AND pi.agreed_by_other_org_id IS NOT NULL
         AND EXISTS (SELECT 1 FROM impact_claims ic WHERE ic.indicator_id = pi.id AND ic.claiming_org_id = p_org_id))::integer,
    (SELECT COUNT(*) FROM mou_documents WHERE (org_a_id = p_org_id OR org_b_id = p_org_id) AND status = 'fully_executed')::integer,
    (SELECT COUNT(*) FROM mou_milestones mm
       JOIN mou_documents md ON md.id = mm.mou_document_id
       WHERE (md.org_a_id = p_org_id OR md.org_b_id = p_org_id)
         AND mm.status = 'verified')::integer;
$$;

GRANT EXECUTE ON FUNCTION public.get_track_record_summary(uuid) TO authenticated;
