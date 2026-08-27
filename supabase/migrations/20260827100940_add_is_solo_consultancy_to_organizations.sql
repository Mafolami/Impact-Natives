ALTER TABLE organizations
  ADD COLUMN is_solo_consultancy boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN organizations.is_solo_consultancy IS
  'True when this org is a solo/one-person consultancy. Used to skip the DD Readiness checklist (built for institutional scale) and to identify accounts that reached org status via the individual-to-consultancy conversion on-ramp. Independent of organisation_type and registration_type -- do not infer this from either.';
