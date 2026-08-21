
CREATE OR REPLACE FUNCTION enforce_indicator_before_send()

RETURNS TRIGGER

LANGUAGE plpgsql

SECURITY DEFINER

SET search_path = public

AS $$

BEGIN

  IF NEW.status = 'sent' AND (OLD.status IS DISTINCT FROM 'sent') THEN

    IF NOT EXISTS (

      SELECT 1 FROM partnership_indicators WHERE mou_document_id = NEW.id

    ) THEN

      RAISE EXCEPTION 'At least one partnership indicator is required before this MoU can be sent.';

    END IF;

  END IF;

  RETURN NEW;

END;

$$;

DROP TRIGGER IF EXISTS trg_enforce_indicator_before_send ON mou_documents;

CREATE TRIGGER trg_enforce_indicator_before_send

  BEFORE UPDATE ON mou_documents

  FOR EACH ROW

  EXECUTE FUNCTION enforce_indicator_before_send();

