-- New initiative submitted for review
CREATE TRIGGER "admin-review-notification-initiative"
AFTER INSERT ON public.initiative_requests
FOR EACH ROW
WHEN (NEW.status = 'pending')
EXECUTE FUNCTION supabase_functions.http_request(
  'https://lzpxlnjvegpxjuexyjdj.supabase.co/functions/v1/admin-review-notification',
  'POST',
  '{"Content-type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6cHhsbmp2ZWdweGp1ZXh5amRqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTg5MzY1NywiZXhwIjoyMDk1NDY5NjU3fQ.gUdj71h9UQV1do7Rm1l62VPD6pC1bWrBUlCMtee04Xk"}',
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
  '{"Content-type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6cHhsbmp2ZWdweGp1ZXh5amRqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTg5MzY1NywiZXhwIjoyMDk1NDY5NjU3fQ.gUdj71h9UQV1do7Rm1l62VPD6pC1bWrBUlCMtee04Xk"}',
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
  '{"Content-type":"application/json","Authorization":"Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx6cHhsbmp2ZWdweGp1ZXh5amRqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTg5MzY1NywiZXhwIjoyMDk1NDY5NjU3fQ.gUdj71h9UQV1do7Rm1l62VPD6pC1bWrBUlCMtee04Xk"}',
  '{}',
  '5000'
);
