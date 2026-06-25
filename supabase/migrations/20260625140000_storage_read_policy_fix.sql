drop policy if exists storage_lead_attachments_read on storage.objects;
create policy storage_lead_attachments_read on storage.objects
  for select to authenticated
  using (
    storage.objects.bucket_id = 'lead-attachments'
    and (
      public.is_admin()
      or exists (
        select 1
        from public.lead_attachments a
        join public.leads l on l.id = a.lead_id
        where a.storage_bucket = storage.objects.bucket_id
          and a.storage_path = storage.objects.name
          and l.partner_id = public.current_partner_id()
          and not a.is_private
      )
    )
  );

drop policy if exists storage_partner_documents_read on storage.objects;
create policy storage_partner_documents_read on storage.objects
  for select to authenticated
  using (
    storage.objects.bucket_id = 'partner-documents'
    and (
      public.is_admin()
      or exists (
        select 1
        from public.partner_documents d
        where d.storage_bucket = storage.objects.bucket_id
          and d.storage_path = storage.objects.name
          and d.partner_id = public.current_partner_id()
          and not d.is_private
      )
    )
  );

drop policy if exists storage_discovery_files_read on storage.objects;
create policy storage_discovery_files_read on storage.objects
  for select to authenticated
  using (
    storage.objects.bucket_id = 'discovery-call-files'
    and (
      public.is_admin()
      or exists (
        select 1
        from public.discovery_call_attachments a
        join public.discovery_calls dc on dc.id = a.discovery_call_id
        join public.leads l on l.id = dc.lead_id
        where a.storage_bucket = storage.objects.bucket_id
          and a.storage_path = storage.objects.name
          and l.partner_id = public.current_partner_id()
          and not dc.is_private
      )
    )
  );
