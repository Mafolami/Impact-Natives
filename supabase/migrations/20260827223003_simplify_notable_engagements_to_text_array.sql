ALTER TABLE organizations
  ALTER COLUMN notable_engagements TYPE text[] USING NULL;

COMMENT ON COLUMN organizations.notable_engagements IS
  'Array of short narrative entries describing notable consulting engagements -- what was done, for whom, in what context. Not a bare client-name list: a name alone (e.g. "Icebreaker One") carries no credibility signal for a stranger the way a known funder name does for an NGO, so entries should be descriptive lines, not tags. Same tag-input UI pattern as specializations/affiliations, just encouraging longer entries. Intended for is_solo_consultancy orgs.';
