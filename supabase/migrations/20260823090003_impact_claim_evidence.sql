CREATE TABLE impact_claim_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL REFERENCES impact_claims(id) ON DELETE CASCADE,
  proof_point_id uuid REFERENCES indicator_proof_points(id),
  justification_text text NOT NULL,
  evidence_type text NOT NULL CHECK (evidence_type IN ('file', 'link')),
  evidence_value text NOT NULL,
  carried_forward boolean NOT NULL DEFAULT false,
  reviewer_dismissed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX impact_claim_evidence_claim_id_idx ON impact_claim_evidence(claim_id);
CREATE INDEX impact_claim_evidence_proof_point_id_idx ON impact_claim_evidence(proof_point_id);

ALTER TABLE impact_claim_evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "impact_claim_evidence_select"
  ON impact_claim_evidence
  FOR SELECT
  TO public
  USING (
    is_mou_participant(
      (SELECT pi.mou_document_id
       FROM impact_claims ic
       JOIN partnership_indicators pi ON pi.id = ic.indicator_id
       WHERE ic.id = impact_claim_evidence.claim_id)
    )
  );

CREATE POLICY "impact_claim_evidence_insert"
  ON impact_claim_evidence
  FOR INSERT
  TO public
  WITH CHECK (
    is_mou_participant(
      (SELECT pi.mou_document_id
       FROM impact_claims ic
       JOIN partnership_indicators pi ON pi.id = ic.indicator_id
       WHERE ic.id = impact_claim_evidence.claim_id)
    )
    AND
    (SELECT ic.claiming_org_id FROM impact_claims ic WHERE ic.id = impact_claim_evidence.claim_id)
      IN (SELECT id FROM organizations WHERE user_id = auth.uid())
  );
