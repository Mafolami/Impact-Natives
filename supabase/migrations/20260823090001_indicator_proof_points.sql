CREATE TABLE indicator_proof_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  indicator_id uuid NOT NULL REFERENCES partnership_indicators(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE indicator_proof_points ENABLE ROW LEVEL SECURITY;

CREATE POLICY "indicator_proof_points_select"
  ON indicator_proof_points
  FOR SELECT
  TO public
  USING (
    is_mou_participant(
      (SELECT mou_document_id FROM partnership_indicators WHERE id = indicator_proof_points.indicator_id)
    )
  );

CREATE POLICY "indicator_proof_points_insert"
  ON indicator_proof_points
  FOR INSERT
  TO public
  WITH CHECK (
    is_mou_participant(
      (SELECT mou_document_id FROM partnership_indicators WHERE id = indicator_proof_points.indicator_id)
    )
    AND
    (SELECT created_by_org_id FROM partnership_indicators WHERE id = indicator_proof_points.indicator_id)
      IN (SELECT id FROM organizations WHERE user_id = auth.uid())
  );

CREATE POLICY "indicator_proof_points_delete_before_agreement"
  ON indicator_proof_points
  FOR DELETE
  TO authenticated
  USING (
    (SELECT agreed_by_other_org_id FROM partnership_indicators WHERE id = indicator_proof_points.indicator_id) IS NULL
    AND is_mou_participant(
      (SELECT mou_document_id FROM partnership_indicators WHERE id = indicator_proof_points.indicator_id)
    )
    AND (SELECT created_by_org_id FROM partnership_indicators WHERE id = indicator_proof_points.indicator_id)
      IN (SELECT id FROM organizations WHERE user_id = auth.uid())
  );

ALTER TABLE partnership_indicators ADD COLUMN suggested_proof_points jsonb;
