DROP POLICY IF EXISTS select_initiatives ON initiative_requests;

CREATE POLICY select_initiatives ON initiative_requests
FOR SELECT
TO public
USING (
  status = 'published'
  OR user_id = auth.uid()
  OR is_admin()
  OR is_member_of_owner(user_id)
  OR EXISTS (
    SELECT 1 FROM mou_documents md
    WHERE md.initiative_id = initiative_requests.id
      AND (
        md.org_a_id IN (SELECT id FROM organizations WHERE user_id = auth.uid())
        OR md.org_b_id IN (SELECT id FROM organizations WHERE user_id = auth.uid())
      )
  )
);
