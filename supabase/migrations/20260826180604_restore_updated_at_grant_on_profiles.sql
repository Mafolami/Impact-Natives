-- Follow-up to the previous lock-down migration. saveProfileFields()
-- stamps updated_at on every single call alongside whatever field is
-- actually being edited (e.g. sectors, phone, bio). A column-restricted
-- GRANT UPDATE requires every column in the SET clause to be granted, or
-- the entire statement fails with permission denied -- excluding
-- updated_at broke every profile edit path (Focus Areas, Contact Details,
-- Online Presence) for both individual and org accounts. updated_at is a
-- harmless, non-security-sensitive field for a user to set on their own
-- row; it was excluded by oversight, not by design.
GRANT UPDATE (updated_at) ON public.profiles TO authenticated;
