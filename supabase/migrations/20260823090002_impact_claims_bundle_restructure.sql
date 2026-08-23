ALTER TABLE impact_claims
  DROP COLUMN claim_text,
  DROP COLUMN indicator_value,
  DROP COLUMN evidence_type,
  DROP COLUMN evidence_value;

ALTER TABLE impact_claims
  ADD COLUMN prior_claim_id uuid REFERENCES impact_claims(id);
