DROP FUNCTION IF EXISTS public.create_partnership_conversation(uuid, uuid, uuid);

CREATE OR REPLACE FUNCTION public.create_partnership_conversation(p_receiver_user_id uuid, p_connection_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_conv_id uuid;
BEGIN
  INSERT INTO conversations (conversation_type, status, initiative_owner_id)
  VALUES ('partnership', 'pending_acceptance', p_receiver_user_id)
  RETURNING id INTO v_conv_id;

  UPDATE partnership_connections
  SET conversation_id = v_conv_id
  WHERE id = p_connection_id
  AND conversation_id IS NULL;

  RETURN v_conv_id;
END;
$function$;
