-- ============================================================
-- Impact Verification System: partnership_indicators, impact_claims,
-- impact_claim_status_history
-- ============================================================

CREATE TABLE partnership_indicators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mou_document_id UUID NOT NULL REFERENCES mou_documents(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  definition TEXT NOT NULL,
  baseline_value TEXT,
  target_value TEXT NOT NULL,
  measurement_window TEXT NOT NULL,
  created_by_org_id UUID NOT NULL REFERENCES organizations(id),
  agreed_by_other_org_id UUID REFERENCES organizations(id),
  agreed_by_other_org_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_partnership_indicators_mou_document_id
  ON partnership_indicators(mou_document_id);

CREATE TABLE impact_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  indicator_id UUID NOT NULL REFERENCES partnership_indicators(id) ON DELETE CASCADE,
  milestone_id UUID REFERENCES mou_milestones(id),
  claiming_org_id UUID NOT NULL REFERENCES organizations(id),
  claim_text TEXT NOT NULL,
  indicator_value TEXT NOT NULL,
  evidence_type TEXT NOT NULL CHECK (evidence_type IN ('file', 'link')),
  evidence_value TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'confirmed', 'challenged', 'disputed')),
  confirmed_by_org_id UUID REFERENCES organizations(id),
  confirmed_at TIMESTAMPTZ,
  challenge_reason TEXT,
  challenge_raised_by_org_id UUID REFERENCES organizations(id),
  challenge_raised_at TIMESTAMPTZ,
  response_window_days INT CHECK (response_window_days >= 14),
  response_deadline TIMESTAMPTZ,
  claimant_response TEXT,
  disputed_by_org_id UUID REFERENCES organizations(id),
  disputed_at TIMESTAMPTZ,
  dispute_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_impact_claims_indicator_id ON impact_claims(indicator_id);
CREATE INDEX idx_impact_claims_status ON impact_claims(status);

CREATE TABLE impact_claim_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id UUID NOT NULL REFERENCES impact_claims(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  changed_by_org_id UUID NOT NULL REFERENCES organizations(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason TEXT
);

CREATE INDEX idx_impact_claim_status_history_claim_id
  ON impact_claim_status_history(claim_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON partnership_indicators TO authenticated;
GRANT ALL ON partnership_indicators TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON impact_claims TO authenticated;
GRANT ALL ON impact_claims TO service_role;

GRANT SELECT, INSERT ON impact_claim_status_history TO authenticated;
GRANT ALL ON impact_claim_status_history TO service_role;
