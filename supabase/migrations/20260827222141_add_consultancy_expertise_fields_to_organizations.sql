ALTER TABLE organizations
  ADD COLUMN specializations text[],
  ADD COLUMN notable_engagements jsonb,
  ADD COLUMN affiliations text[];

COMMENT ON COLUMN organizations.specializations IS
  'Free-text tags describing a consultancy''s areas of expertise (e.g. "MEL design", "Grant compliance"). Intended for is_solo_consultancy orgs, replacing Impact & Track Record fields that assume institutional scale.';

COMMENT ON COLUMN organizations.notable_engagements IS
  'Array of short narrative entries describing notable consulting engagements -- what was done, for whom, in what context. Not a bare client-name list: a name alone (e.g. "Icebreaker One") carries no credibility signal for a stranger the way a known funder name does for an NGO, so entries should include context. Intended for is_solo_consultancy orgs.';

COMMENT ON COLUMN organizations.affiliations IS
  'Free-text tags for alumni networks, certifications, or prior institutional roles that lend credibility to a solo consultancy (e.g. "PMI-ACP certified", "UNITAR traineeship alumnus"). Intended for is_solo_consultancy orgs.';
