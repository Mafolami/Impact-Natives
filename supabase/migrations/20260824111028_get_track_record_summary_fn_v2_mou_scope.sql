-- v2: adds optional p_mou_document_id to scope every figure to one
-- agreement instead of the whole portfolio, powering the "Viewing:"
-- filter on the Track Record page. Signature changed (new param), so
-- drop the old uuid-only version first rather than leave two overloads.
DROP FUNCTION IF EXISTS public.get_track_record_summary(uuid);

CREATE FUNCTION public.get_track_record_summary(p_org_id uuid, p_mou_document_id uuid DEFAULT NULL)
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
    (SELECT COUNT(*) FROM impact_claims ic
       JOIN partnership_indicators pi ON pi.id = ic.indicator_id
       WHERE ic.claiming_org_id = p_org_id AND ic.status = 'confirmed'
         AND (p_mou_document_id IS NULL OR pi.mou_document_id = p_mou_document_id))::integer,
    (SELECT COUNT(*) FROM impact_claims ic
       JOIN partnership_indicators pi ON pi.id = ic.indicator_id
       WHERE ic.claiming_org_id = p_org_id AND ic.status = 'disputed'
         AND (p_mou_document_id IS NULL OR pi.mou_document_id = p_mou_document_id))::integer,
    (SELECT COUNT(*) FROM impact_claims ic
       JOIN partnership_indicators pi ON pi.id = ic.indicator_id
       WHERE ic.claiming_org_id = p_org_id
         AND (p_mou_document_id IS NULL OR pi.mou_document_id = p_mou_document_id))::integer,
    (SELECT COUNT(DISTINCT ic.confirmed_by_org_id) FROM impact_claims ic
       JOIN partnership_indicators pi ON pi.id = ic.indicator_id
       WHERE ic.claiming_org_id = p_org_id AND ic.status = 'confirmed'
         AND (p_mou_document_id IS NULL OR pi.mou_document_id = p_mou_document_id))::integer,
    (SELECT COUNT(*) FROM partnership_indicators pi
       JOIN mou_documents md ON md.id = pi.mou_document_id
       WHERE (md.org_a_id = p_org_id OR md.org_b_id = p_org_id)
         AND md.status = 'fully_executed'
         AND pi.agreed_by_other_org_id IS NOT NULL
         AND (p_mou_document_id IS NULL OR pi.mou_document_id = p_mou_document_id))::integer,
    (SELECT COUNT(*) FROM partnership_indicators pi
       JOIN mou_documents md ON md.id = pi.mou_document_id
       WHERE (md.org_a_id = p_org_id OR md.org_b_id = p_org_id)
         AND md.status = 'fully_executed'
         AND pi.agreed_by_other_org_id IS NOT NULL
         AND (p_mou_document_id IS NULL OR pi.mou_document_id = p_mou_document_id)
         AND EXISTS (SELECT 1 FROM impact_claims ic WHERE ic.indicator_id = pi.id AND ic.claiming_org_id = p_org_id))::integer,
    (SELECT COUNT(*) FROM mou_documents
       WHERE (org_a_id = p_org_id OR org_b_id = p_org_id) AND status = 'fully_executed'
         AND (p_mou_document_id IS NULL OR id = p_mou_document_id))::integer,
    (SELECT COUNT(*) FROM mou_milestones mm
       JOIN mou_documents md ON md.id = mm.mou_document_id
       WHERE (md.org_a_id = p_org_id OR md.org_b_id = p_org_id)
         AND mm.status = 'verified'
         AND (p_mou_document_id IS NULL OR mm.mou_document_id = p_mou_document_id))::integer;
$$;

GRANT EXECUTE ON FUNCTION public.get_track_record_summary(uuid, uuid) TO authenticated;
