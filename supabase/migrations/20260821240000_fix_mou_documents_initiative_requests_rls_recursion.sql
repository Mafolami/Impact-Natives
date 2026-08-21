
CREATE OR REPLACE FUNCTION is_org_party_on_mou_for_initiative(p_initiative_id UUID)

RETURNS BOOLEAN

LANGUAGE sql

SECURITY DEFINER

SET search_path = public

AS $$

  SELECT EXISTS (

    SELECT 1 FROM mou_documents md

    WHERE md.initiative_id = p_initiative_id

      AND (

        md.org_a_id IN (SELECT id FROM organizations WHERE user_id = auth.uid())

        OR md.org_b_id IN (SELECT id FROM organizations WHERE user_id = auth.uid())

      )

  );

$$;

DROP POLICY IF EXISTS select_initiatives ON initiative_requests;

CREATE POLICY select_initiatives ON initiative_requests FOR SELECT

USING (

  status = 'published'

  OR user_id = auth.uid()

  OR is_admin()

  OR is_member_of_owner(user_id)

  OR is_org_party_on_mou_for_initiative(id)

);

