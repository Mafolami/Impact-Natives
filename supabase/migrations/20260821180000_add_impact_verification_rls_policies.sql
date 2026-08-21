ALTER TABLE partnership_indicators ENABLE ROW LEVEL SECURITY;
ALTER TABLE impact_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE impact_claim_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY partnership_indicators_select
  ON partnership_indicators FOR SELECT
  USING (is_mou_participant(mou_document_id));

CREATE POLICY partnership_indicators_insert
  ON partnership_indicators FOR INSERT
  WITH CHECK (
    is_mou_participant(mou_document_id)
    AND created_by_org_id IN (
      SELECT id FROM organizations WHERE user_id = auth.uid()
    )
  );

CREATE POLICY partnership_indicators_update
  ON partnership_indicators FOR UPDATE
  USING (is_mou_participant(mou_document_id));

CREATE POLICY impact_claims_select
  ON impact_claims FOR SELECT
  USING (
    is_mou_participant((
      SELECT mou_document_id FROM partnership_indicators
      WHERE id = impact_claims.indicator_id
    ))
  );

CREATE POLICY impact_claims_insert
  ON impact_claims FOR INSERT
  WITH CHECK (
    is_mou_participant((
      SELECT mou_document_id FROM partnership_indicators
      WHERE id = impact_claims.indicator_id
    ))
    AND claiming_org_id IN (
      SELECT id FROM organizations WHERE user_id = auth.uid()
    )
  );

REVOKE UPDATE ON impact_claims FROM authenticated;

CREATE POLICY impact_claim_status_history_select
  ON impact_claim_status_history FOR SELECT
  USING (
    is_mou_participant((
      SELECT pi.mou_document_id
      FROM impact_claims ic
      JOIN partnership_indicators pi ON pi.id = ic.indicator_id
      WHERE ic.id = impact_claim_status_history.claim_id
    ))
  );

REVOKE INSERT ON impact_claim_status_history FROM authenticated;
