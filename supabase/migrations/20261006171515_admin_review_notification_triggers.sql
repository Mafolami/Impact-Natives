-- New initiative submitted for review
CREATE TRIGGER "admin-review-notification-initiative"
AFTER INSERT ON public.initiative_requests
FOR EACH ROW
WHEN (NEW.status = 'pending')
EXECUTE FUNCTION supabase_functions.http_request(
  'https://lzpxlnjvegpxjuexyjdj.supabase.co/functions/v1/admin-review-notification',
  'POST',
  '{"Content-type":"application/json","Authorization":"Bearer REDACTED"}',
  '{}',
  '5000'
);

-- New organization signup pending review
CREATE TRIGGER "admin-review-notification-org-signup"
AFTER INSERT ON public.organizations
FOR EACH ROW
WHEN (NEW.status = 'pending')
EXECUTE FUNCTION supabase_functions.http_request(
  'https://lzpxlnjvegpxjuexyjdj.supabase.co/functions/v1/admin-review-notification',
  'POST',
  '{"Content-type":"application/json","Authorization":"Bearer REDACTED"}',
  '{}',
  '5000'
);

-- Organization requesting verification (verification_status -> pending)
CREATE TRIGGER "admin-review-notification-org-verification"
AFTER UPDATE ON public.organizations
FOR EACH ROW
WHEN (NEW.verification_status = 'pending' AND OLD.verification_status IS DISTINCT FROM 'pending')
EXECUTE FUNCTION supabase_functions.http_request(
  'https://lzpxlnjvegpxjuexyjdj.supabase.co/functions/v1/admin-review-notification',
  'POST',
  '{"Content-type":"application/json","Authorization":"Bearer REDACTED"}',
  '{}',
  '5000'
);
