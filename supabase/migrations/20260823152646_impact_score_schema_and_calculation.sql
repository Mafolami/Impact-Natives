ALTER TABLE organizations ADD COLUMN impact_score numeric NOT NULL DEFAULT 0;
ALTER TABLE organizations ADD COLUMN impact_score_updated_at timestamptz;

CREATE INDEX organizations_impact_score_idx ON organizations(impact_score DESC);

CREATE OR REPLACE FUNCTION public.recompute_impact_score(p_org_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recency_sum numeric;
  v_distinct_partners integer;
  v_disputed_count integer;
  v_diversity_bonus numeric;
  v_score numeric;
BEGIN
  SELECT COALESCE(SUM(
    CASE
      WHEN confirmed_at >= now() - interval '12 months' THEN 1.0
      WHEN confirmed_at >= now() - interval '24 months' THEN 0.6
      ELSE 0.3
    END
  ), 0)
  INTO v_recency_sum
  FROM impact_claims
  WHERE claiming_org_id = p_org_id AND status = 'confirmed';

  SELECT COUNT(DISTINCT confirmed_by_org_id)
  INTO v_distinct_partners
  FROM impact_claims
  WHERE claiming_org_id = p_org_id AND status = 'confirmed';

  SELECT COUNT(*)
  INTO v_disputed_count
  FROM impact_claims
  WHERE claiming_org_id = p_org_id AND status = 'disputed';

  v_diversity_bonus := LEAST(GREATEST(v_distinct_partners - 1, 0), 4) * 2;
  v_score := v_recency_sum + v_diversity_bonus - (v_disputed_count * 2);

  UPDATE organizations
  SET impact_score = v_score, impact_score_updated_at = now()
  WHERE id = p_org_id;

  RETURN v_score;
END;
$$;
