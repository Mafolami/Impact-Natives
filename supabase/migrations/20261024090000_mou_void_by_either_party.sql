-- 24 Oct 2026: either party can void and reopen an MoU.
-- void_and_reopen_mou allows either org's signer, but it clears BOTH
-- signatures, and protect_mou_signing_fields only lets org A's signer touch
-- org A's signature fields. So when org B voided after org A had signed it
-- failed with "Only the org owner or designated signatory can sign or
-- finalize on behalf of org A". The RPC now marks its own transaction and
-- the trigger lets that one write through. Clients can't set this flag:
-- set_config isn't exposed through the API.
-- Applied by hand in the Supabase SQL editor (recorded here for history;
-- not in the live migration history).

create or replace function public.protect_mou_signing_fields()
returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare
  touches_org_a_signing boolean;
  touches_org_b_signing boolean;
  touches_shared_signing boolean;
begin
  -- Set only by void_and_reopen_mou, which does its own authorization.
  if current_setting('app.mou_void_reopen', true) = 'on' then
    return new;
  end if;

  touches_org_a_signing :=
    (new.signature_org_a_path is distinct from old.signature_org_a_path)
    or (new.signed_at_org_a is distinct from old.signed_at_org_a)
    or (new.signature_locked_org_a is distinct from old.signature_locked_org_a);

  touches_org_b_signing :=
    (new.signature_org_b_path is distinct from old.signature_org_b_path)
    or (new.signed_at_org_b is distinct from old.signed_at_org_b)
    or (new.signature_locked_org_b is distinct from old.signature_locked_org_b)
    or (new.org_b_finalization_confirmed is distinct from old.org_b_finalization_confirmed);

  touches_shared_signing :=
    (new.partnership_status_confirmed is distinct from old.partnership_status_confirmed)
    or (new.fully_executed_at is distinct from old.fully_executed_at);

  if touches_org_a_signing and not public.can_confirm_mou_for_org(old.org_a_id) then
    raise exception 'Only the org owner or designated signatory can sign or finalize on behalf of org A';
  end if;

  if touches_org_b_signing and not public.can_confirm_mou_for_org(old.org_b_id) then
    raise exception 'Only the org owner or designated signatory can sign or finalize on behalf of org B';
  end if;

  if touches_shared_signing
     and not (public.can_confirm_mou_for_org(old.org_a_id) or public.can_confirm_mou_for_org(old.org_b_id)) then
    raise exception 'Only an authorized signatory of either party can confirm or execute this MoU';
  end if;

  return new;
end;
$function$;

create or replace function public.void_and_reopen_mou(p_document_id uuid)
returns void language plpgsql security definer set search_path to 'public' as $function$
declare
  v_org_a_id uuid;
  v_org_b_id uuid;
  v_status text;
begin
  select d.org_a_id, d.org_b_id, d.status
  into v_org_a_id, v_org_b_id, v_status
  from mou_documents d
  where d.id = p_document_id;

  if v_org_a_id is null then
    raise exception 'mou document not found';
  end if;

  if not (public.can_confirm_mou_for_org(v_org_a_id) or public.can_confirm_mou_for_org(v_org_b_id)) then
    raise exception 'not authorized for this document';
  end if;

  if v_status = 'fully_executed' then
    raise exception 'cannot void a fully executed MoU';
  end if;

  -- Either party may clear both signatures here; see the trigger above.
  perform set_config('app.mou_void_reopen', 'on', true);

  update mou_documents set
    signature_org_a_path = null,
    signature_org_b_path = null,
    signed_at_org_a = null,
    signed_at_org_b = null,
    signature_locked_org_a = false,
    signature_locked_org_b = false,
    details_completed_by_org_a = false,
    details_completed_at_org_a = null,
    org_b_finalization_confirmed = false,
    signed_files = '{}'::jsonb,
    status = 'draft',
    updated_at = now()
  where id = p_document_id;

  perform set_config('app.mou_void_reopen', 'off', true);
end;
$function$;
