-- 14 Oct 2026: close RPCs that anyone with the public key could call
-- without any caller check (found by the Supabase security advisor).

-- 1. compute_daily_nudges returns names/org names/user ids of nudge targets.
--    Only daily-nudge-cron (secret key) calls it.
revoke execute on function public.compute_daily_nudges() from public, anon, authenticated;
grant execute on function public.compute_daily_nudges() to service_role;

-- 2. create_conversation: caller must be signed in, owner must be the
--    initiative's real owner, initiative must be live, no self-conversation.
create or replace function public.create_conversation(p_initiative_id uuid, p_owner_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
DECLARE v_id uuid; v_real_owner uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT user_id INTO v_real_owner FROM initiative_requests
   WHERE id = p_initiative_id AND status IN ('published','closed');
  IF v_real_owner IS NULL OR v_real_owner <> p_owner_id THEN
    RAISE EXCEPTION 'Initiative not found';
  END IF;
  IF v_real_owner = auth.uid() OR v_real_owner = public.resolve_org_owner_id() THEN
    RAISE EXCEPTION 'Cannot open a conversation on your own initiative';
  END IF;
  INSERT INTO conversations (initiative_id, initiative_owner_id, status)
  VALUES (p_initiative_id, p_owner_id, 'pending') RETURNING id INTO v_id;
  RETURN v_id;
END; $$;

-- 3. create_partnership_conversation: caller must be the connection's sender
--    (the user who sent it, the sender org's owner, or an active member).
create or replace function public.create_partnership_conversation(p_receiver_user_id uuid, p_connection_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
DECLARE v_conv_id uuid; v_ok boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT (pc.sender_user_id = auth.uid()
          OR o.user_id = auth.uid()
          OR public.is_org_member(pc.sender_org_id))
    INTO v_ok
    FROM partnership_connections pc LEFT JOIN organizations o ON o.id = pc.sender_org_id
   WHERE pc.id = p_connection_id;
  IF v_ok IS NOT TRUE THEN RAISE EXCEPTION 'Not authorized for this connection'; END IF;
  INSERT INTO conversations (conversation_type, status, initiative_owner_id)
  VALUES ('partnership', 'pending_acceptance', p_receiver_user_id) RETURNING id INTO v_conv_id;
  UPDATE partnership_connections SET conversation_id = v_conv_id
   WHERE id = p_connection_id AND conversation_id IS NULL;
  RETURN v_conv_id;
END; $$;

-- 4. create_ai_match_conversation: sender must be the caller; if a connection
--    is given, caller must be on its sending side.
create or replace function public.create_ai_match_conversation(p_sender_user_id uuid, p_receiver_user_id uuid, p_connection_id uuid DEFAULT NULL::uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_conv_id uuid; v_ok boolean;
begin
  if auth.uid() is null or p_sender_user_id is distinct from auth.uid() then
    raise exception 'Not authorized';
  end if;
  if p_connection_id is not null then
    select (pc.sender_user_id = auth.uid()
            or o.user_id = auth.uid()
            or public.is_org_member(pc.sender_org_id))
      into v_ok
      from partnership_connections pc left join organizations o on o.id = pc.sender_org_id
     where pc.id = p_connection_id;
    if v_ok is not true then raise exception 'Not authorized for this connection'; end if;
  end if;
  insert into conversations (conversation_type, status, initiative_owner_id)
  values ('partnership', 'pending_acceptance', p_receiver_user_id) returning id into v_conv_id;
  insert into conversation_participants (conversation_id, user_id) values (v_conv_id, p_sender_user_id);
  if p_receiver_user_id is not null then
    insert into conversation_participants (conversation_id, user_id) values (v_conv_id, p_receiver_user_id);
  end if;
  if p_connection_id is not null then
    update partnership_connections set conversation_id = v_conv_id
     where id = p_connection_id and conversation_id is null;
  end if;
  return v_conv_id;
end; $$;

-- 5. join_conversation_and_notify: only a brand-new conversation (no
--    participants yet) or one the caller is already in. Before this, anyone
--    holding a conversation id could add themselves to it.
create or replace function public.join_conversation_and_notify(p_conversation_id uuid, p_notification_type text, p_notification_title text, p_notification_body text, p_notification_link text DEFAULT NULL::text, p_notification_metadata jsonb DEFAULT NULL::jsonb)
returns void language plpgsql security definer set search_path = public as $$
DECLARE v_caller_id uuid := auth.uid(); v_recipient_id uuid;
BEGIN
  IF v_caller_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT initiative_owner_id INTO v_recipient_id FROM conversations WHERE id = p_conversation_id;
  IF v_recipient_id IS NULL THEN
    RAISE EXCEPTION 'Conversation % not found or has no designated recipient', p_conversation_id;
  END IF;
  IF EXISTS (SELECT 1 FROM conversation_participants WHERE conversation_id = p_conversation_id)
     AND NOT EXISTS (SELECT 1 FROM conversation_participants
                      WHERE conversation_id = p_conversation_id AND user_id = v_caller_id) THEN
    RAISE EXCEPTION 'Not authorized for this conversation';
  END IF;
  INSERT INTO conversation_participants (conversation_id, user_id)
  VALUES (p_conversation_id, v_caller_id) ON CONFLICT (conversation_id, user_id) DO NOTHING;
  IF v_recipient_id <> v_caller_id THEN
    INSERT INTO conversation_participants (conversation_id, user_id)
    VALUES (p_conversation_id, v_recipient_id) ON CONFLICT (conversation_id, user_id) DO NOTHING;
    IF p_notification_type NOT IN ('question_received', 'eoi_received', 'partnership_interest') THEN
      RAISE EXCEPTION 'Invalid notification type: %', p_notification_type;
    END IF;
    INSERT INTO notifications (user_id, type, title, body, link, metadata)
    VALUES (v_recipient_id, p_notification_type, p_notification_title, p_notification_body, p_notification_link, p_notification_metadata);
  END IF;
END; $$;

-- 6. get_conversation_participants: only conversations the caller (or the
--    caller's org owner) is in or owns, plus admins.
create or replace function public.get_conversation_participants(p_conversation_ids uuid[])
returns table(conversation_id uuid, user_id uuid) language plpgsql security definer set search_path = public as $$
DECLARE v_me uuid := auth.uid(); v_owner uuid := public.resolve_org_owner_id();
BEGIN
  IF v_me IS NULL THEN RETURN; END IF;
  RETURN QUERY
  SELECT cp.conversation_id, cp.user_id
    FROM conversation_participants cp
   WHERE cp.conversation_id = ANY(p_conversation_ids)
     AND (public.is_admin()
          OR EXISTS (SELECT 1 FROM conversation_participants me
                      WHERE me.conversation_id = cp.conversation_id AND me.user_id IN (v_me, v_owner))
          OR EXISTS (SELECT 1 FROM conversations c
                      WHERE c.id = cp.conversation_id AND c.initiative_owner_id IN (v_me, v_owner)));
END; $$;

-- 7. increment_eoi_count: signed-in callers only, not on their own initiative.
create or replace function public.increment_eoi_count(p_initiative_id uuid)
returns void language plpgsql security definer set search_path = public as $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  UPDATE initiative_requests SET eois = eois + 1
   WHERE id = p_initiative_id AND user_id NOT IN (auth.uid(), coalesce(public.resolve_org_owner_id(), auth.uid()));
END; $$;

-- Logged-out visitors never need these.
revoke execute on function public.create_conversation(uuid, uuid) from public, anon;
revoke execute on function public.create_partnership_conversation(uuid, uuid) from public, anon;
revoke execute on function public.create_ai_match_conversation(uuid, uuid, uuid) from public, anon;
revoke execute on function public.join_conversation_and_notify(uuid, text, text, text, text, jsonb) from public, anon;
revoke execute on function public.get_conversation_participants(uuid[]) from public, anon;
revoke execute on function public.increment_eoi_count(uuid) from public, anon;
grant execute on function public.create_conversation(uuid, uuid) to authenticated;
grant execute on function public.create_partnership_conversation(uuid, uuid) to authenticated;
grant execute on function public.create_ai_match_conversation(uuid, uuid, uuid) to authenticated;
grant execute on function public.join_conversation_and_notify(uuid, text, text, text, text, jsonb) to authenticated;
grant execute on function public.get_conversation_participants(uuid[]) to authenticated;
grant execute on function public.increment_eoi_count(uuid) to authenticated;
grant execute on function public.create_conversation(uuid, uuid), public.create_partnership_conversation(uuid, uuid),
  public.create_ai_match_conversation(uuid, uuid, uuid), public.join_conversation_and_notify(uuid, text, text, text, text, jsonb),
  public.get_conversation_participants(uuid[]), public.increment_eoi_count(uuid) to service_role;

-- 8. Trigger functions are never meant to be called over the API. Revoking
--    EXECUTE does not stop triggers firing.
do $$
declare r record;
begin
  for r in select p.oid::regprocedure as sig from pg_proc p
            where p.pronamespace = 'public'::regnamespace and p.prorettype = 'trigger'::regtype
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.sig);
  end loop;
end $$;

-- 9. Pin search_path on the three functions the advisor flagged.
alter function public.set_onboarding_completed_at() set search_path = public;
alter function public.set_updated_at() set search_path = public;
alter function public.delete_org_by_id(uuid) set search_path = public;
