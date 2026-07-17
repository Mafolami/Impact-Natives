-- funder_decisions had RLS policies but no table-level GRANT for
-- authenticated or service_role, so every access hit 42501 before RLS was
-- ever evaluated. This restores the missing privileges; RLS still governs
-- per-row access (funder_id = auth.uid()) exactly as before.

grant select, insert, update, delete on public.funder_decisions to authenticated;
grant select, insert, update, delete on public.funder_decisions to service_role;
