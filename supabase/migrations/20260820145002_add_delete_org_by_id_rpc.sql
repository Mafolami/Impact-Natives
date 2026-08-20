CREATE OR REPLACE FUNCTION public.delete_org_by_id(target_org_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  executed_mou_count INT;
  total_mou_count INT;
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Unauthorised';
  END IF;

  SELECT COUNT(*) FILTER (WHERE status = 'fully_executed'), COUNT(*)
  INTO executed_mou_count, total_mou_count
  FROM mou_documents
  WHERE org_a_id = target_org_id OR org_b_id = target_org_id;

  DELETE FROM dd_evidence_documents
    WHERE organization_id = target_org_id;

  DELETE FROM dd_export_requests
    WHERE exporter_org_id = target_org_id OR subject_org_id = target_org_id;

  DELETE FROM partnership_match_cache
    WHERE org_id = target_org_id OR matched_org_id = target_org_id;

  DELETE FROM saved_organizations
    WHERE organization_id = target_org_id;

  DELETE FROM favorites
    WHERE organization_id = target_org_id;

  DELETE FROM workflow_comments
    WHERE org_id = target_org_id;

  DELETE FROM org_members
    WHERE org_id = target_org_id;

  DELETE FROM org_activity_log
    WHERE org_id = target_org_id;

  DELETE FROM organizations WHERE id = target_org_id;

  RETURN jsonb_build_object(
    'deleted', true,
    'mous_preserved', total_mou_count,
    'executed_mous_preserved', executed_mou_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_org_by_id(UUID) TO authenticated;
