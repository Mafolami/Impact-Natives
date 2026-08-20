-- mou_documents.org_a_id / org_b_id: allow null, switch FK to SET NULL
ALTER TABLE mou_documents ALTER COLUMN org_a_id DROP NOT NULL;
ALTER TABLE mou_documents ALTER COLUMN org_b_id DROP NOT NULL;

ALTER TABLE mou_documents DROP CONSTRAINT mou_documents_org_a_id_fkey;
ALTER TABLE mou_documents ADD CONSTRAINT mou_documents_org_a_id_fkey
  FOREIGN KEY (org_a_id) REFERENCES organizations(id) ON DELETE SET NULL;

ALTER TABLE mou_documents DROP CONSTRAINT mou_documents_org_b_id_fkey;
ALTER TABLE mou_documents ADD CONSTRAINT mou_documents_org_b_id_fkey
  FOREIGN KEY (org_b_id) REFERENCES organizations(id) ON DELETE SET NULL;

-- mou_milestones.payer_org_id / recipient_org_id: already nullable, switch FK to SET NULL
ALTER TABLE mou_milestones DROP CONSTRAINT mou_milestones_payer_org_id_fkey;
ALTER TABLE mou_milestones ADD CONSTRAINT mou_milestones_payer_org_id_fkey
  FOREIGN KEY (payer_org_id) REFERENCES organizations(id) ON DELETE SET NULL;

ALTER TABLE mou_milestones DROP CONSTRAINT mou_milestones_recipient_org_id_fkey;
ALTER TABLE mou_milestones ADD CONSTRAINT mou_milestones_recipient_org_id_fkey
  FOREIGN KEY (recipient_org_id) REFERENCES organizations(id) ON DELETE SET NULL;
