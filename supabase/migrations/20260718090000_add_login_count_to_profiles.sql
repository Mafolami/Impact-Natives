-- Supports the "swap Getting Started for live match content on second
-- login" behavior on Implementer Home. Supabase's auth.users only tracks
-- last_sign_in_at (a single timestamp), not a count, so this is a genuinely
-- new counter, incremented once per sign-in from AuthContext.tsx.

alter table public.profiles
  add column login_count integer not null default 0;
