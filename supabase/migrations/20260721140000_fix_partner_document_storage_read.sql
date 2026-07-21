-- A later agreement-gate migration accidentally made `name` resolve to
-- partner_documents.name inside the correlated storage policy.

drop policy if exists storage_partner_documents_read on storage.objects;
create policy storage_partner_documents_read on storage.objects
for select to authenticated
using (
  storage.objects.bucket_id = 'partner-documents'
  and (
    public.is_admin()
    or (
      public.partner_has_program_access()
      and exists (
        select 1
        from public.partner_documents document
        where document.storage_bucket = storage.objects.bucket_id
          and document.storage_path = storage.objects.name
          and public.is_current_partner(document.partner_id)
          and not document.is_private
      )
    )
  )
);
