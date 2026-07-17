-- Atomic increment for profiles.login_count, called once per real sign-in
-- from AuthContext.tsx (SIGNED_IN event only, not on session restoration or
-- token refresh). Follows the same SECURITY DEFINER RPC pattern already
-- used by increment_eoi_count elsewhere in this schema, to avoid a
-- read-then-write race across multiple tabs/devices.

create or replace function public.increment_login_count()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set login_count = login_count + 1
  where id = auth.uid();
end;
$$;

grant execute on function public.increment_login_count() to authenticated;
