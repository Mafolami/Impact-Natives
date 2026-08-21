insert into storage.buckets (id, name, public)
values ('impact-evidence', 'impact-evidence', false)
on conflict (id) do nothing;

create policy impact_evidence_select
  on storage.objects for select
  using (
    bucket_id = 'impact-evidence'
    and is_mou_participant((
      select mou_document_id from partnership_indicators
      where id = (storage.foldername(name))[2]::uuid
    ))
  );

create policy impact_evidence_insert
  on storage.objects for insert
  with check (
    bucket_id = 'impact-evidence'
    and is_mou_participant((
      select mou_document_id from partnership_indicators
      where id = (storage.foldername(name))[2]::uuid
    ))
  );
