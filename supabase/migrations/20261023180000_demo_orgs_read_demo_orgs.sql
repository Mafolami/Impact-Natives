-- 23 Oct 2026: demo orgs can read other demo orgs.
-- "Anyone can read published organizations" excludes demo orgs, so a demo
-- account (e.g. Sahel Youth Foundation) couldn't load another demo org
-- (e.g. Dear Founders Corp) and demo-to-demo MoUs failed in the UI.
-- Real orgs are unaffected; demo orgs stay hidden from real users.
-- Helper is security definer because a policy on organizations that queries
-- organizations directly would recurse.
-- Applied by hand in the Supabase SQL editor on 23 Oct 2026 (recorded here
-- for history; not in the live migration history).

create or replace function public.viewer_is_demo_org()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from organizations o
     where o.is_demo_org = true
       and (o.user_id = auth.uid() or public.is_org_member(o.id))
  );
$$;
revoke execute on function public.viewer_is_demo_org() from public, anon;
grant execute on function public.viewer_is_demo_org() to authenticated;

drop policy if exists "Demo orgs can read other demo orgs" on public.organizations;
create policy "Demo orgs can read other demo orgs" on public.organizations
  for select to authenticated
  using (is_demo_org = true and public.viewer_is_demo_org());
