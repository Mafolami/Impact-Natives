CREATE OR REPLACE FUNCTION accept_indicator_refinement(p_indicator_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_indicator partnership_indicators%ROWTYPE;
  v_caller_org_id uuid;
  v_proof_point jsonb;
BEGIN
  SELECT id INTO v_caller_org_id FROM organizations WHERE user_id = auth.uid();
  IF v_caller_org_id IS NULL THEN
    RAISE EXCEPTION 'No organisation found for this account';
  END IF;

  SELECT * INTO v_indicator FROM partnership_indicators WHERE id = p_indicator_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Indicator not found';
  END IF;

  IF NOT is_mou_participant(v_indicator.mou_document_id) THEN
    RAISE EXCEPTION 'Not a participant on this agreement';
  END IF;

  IF v_indicator.suggested_by_org_id IS NULL THEN
    RAISE EXCEPTION 'No pending refinement suggestion on this indicator';
  END IF;

  IF v_indicator.suggested_by_org_id = v_caller_org_id THEN
    RAISE EXCEPTION 'Only the counterparty can accept a refinement suggestion';
  END IF;

  -- proposeIndicatorRefinement always submits the complete field set
  -- (name/definition/target_value/measurement_window required, baseline/source
  -- nullable but always present) -- direct assignment, no COALESCE needed.
  UPDATE partnership_indicators
  SET
    name = v_indicator.suggested_name,
    definition = v_indicator.suggested_definition,
    baseline_value = v_indicator.suggested_baseline_value,
    target_value = v_indicator.suggested_target_value,
    measurement_window = v_indicator.suggested_measurement_window,
    source = v_indicator.suggested_source,
    agreed_by_other_org_id = NULL,
    agreed_by_other_org_at = NULL,
    rejected_by_org_id = NULL,
    rejected_by_org_at = NULL,
    rejection_reason = NULL,
    suggested_by_org_id = NULL,
    suggested_at = NULL,
    suggested_name = NULL,
    suggested_definition = NULL,
    suggested_baseline_value = NULL,
    suggested_target_value = NULL,
    suggested_measurement_window = NULL,
    suggested_source = NULL,
    suggested_proof_points = NULL
  WHERE id = p_indicator_id;

  IF v_indicator.suggested_proof_points IS NOT NULL THEN
    DELETE FROM indicator_proof_points WHERE indicator_id = p_indicator_id;

    FOR v_proof_point IN SELECT * FROM jsonb_array_elements(v_indicator.suggested_proof_points)
    LOOP
      INSERT INTO indicator_proof_points (indicator_id, name, description)
      VALUES (
        p_indicator_id,
        v_proof_point->>'name',
        v_proof_point->>'description'
      );
    END LOOP;
  END IF;
END;
$$;
