ALTER TABLE impact_claims
  ADD CONSTRAINT chk_challenge_reason_required
    CHECK (status != 'challenged' OR challenge_reason IS NOT NULL);

ALTER TABLE impact_claims
  ADD CONSTRAINT chk_dispute_reason_required
    CHECK (status != 'disputed' OR dispute_reason IS NOT NULL);
