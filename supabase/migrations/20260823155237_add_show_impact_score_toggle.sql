-- Default-on: the moment an org upgrades to Plus+, their score goes
-- public immediately without them needing to find a setting first --
-- shows off the feature rather than leaving it invisible until
-- discovered. Free tier: this column is inert (canDisplayImpactScore
-- already blocks on tier first), but the org can still see their own
-- real score privately -- that's the point, it's the upgrade motivator.
ALTER TABLE organizations ADD COLUMN show_impact_score boolean NOT NULL DEFAULT true;
