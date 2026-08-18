CREATE POLICY "Admin can delete contact_submissions"
  ON public.contact_submissions
  FOR DELETE
  USING (is_admin());
