-- Submitting a claim is the active, self-benefiting side of verification
-- (builds the claimant's own Verified Outcomes profile) -- gated at Plus,
-- same class of action as MoU creation. Reviewing/confirming/disputing a
-- claim submitted against you is the passive, forced-participation side
-- and stays free on every tier, same logic as MoU signing staying free
-- for the counterparty -- transition-impact-claim is deliberately left
-- ungated, no change there.
ALTER POLICY "impact_claims_insert" ON impact_claims
WITH CHECK (
  is_mou_participant(
    (SELECT mou_document_id FROM partnership_indicators WHERE id = impact_claims.indicator_id)
  )
  AND claiming_org_id IN (SELECT id FROM organizations WHERE user_id = auth.uid())
  AND EXISTS (
    SELECT 1 FROM organizations o
    WHERE o.id = impact_claims.claiming_org_id
    AND o.subscription_tier IN ('plus', 'pro', 'compliance')
  )
);
