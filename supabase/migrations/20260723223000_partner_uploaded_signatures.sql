-- Store optional uploaded signature images against an exact legal acceptance.

alter table public.partner_agreement_acceptances
  add column if not exists signature_bucket text,
  add column if not exists signature_path text,
  add column if not exists signature_file_name text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'partner-signatures',
  'partner-signatures',
  false,
  2097152,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists storage_partner_signatures_read on storage.objects;
create policy storage_partner_signatures_read on storage.objects
for select to authenticated
using (
  bucket_id = 'partner-signatures'
  and (
    public.is_admin()
    or (storage.foldername(name))[1] = auth.uid()::text
  )
);

drop policy if exists storage_partner_signatures_insert_own on storage.objects;
create policy storage_partner_signatures_insert_own on storage.objects
for insert to authenticated
with check (
  bucket_id = 'partner-signatures'
  and (storage.foldername(name))[1] = auth.uid()::text
  and public.current_partner_id() is not null
);

drop policy if exists storage_partner_signatures_delete_own on storage.objects;
create policy storage_partner_signatures_delete_own on storage.objects
for delete to authenticated
using (
  bucket_id = 'partner-signatures'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop function if exists public.accept_partner_agreement_document(text, text, text, text);

create function public.accept_partner_agreement_document(
  target_document_type text,
  signer_name text,
  signer_email text,
  browser_user_agent text default null,
  uploaded_signature_path text default null,
  uploaded_signature_file_name text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  partner uuid := public.current_partner_id();
  document_row public.agreement_documents%rowtype;
  onboarding_step uuid;
  acceptance_inserted integer := 0;
begin
  if partner is null then
    raise exception 'Only linked Sales Partners can sign agreement documents';
  end if;
  if target_document_type not in ('Agreement', 'NDA') then
    raise exception 'Document type must be Agreement or NDA';
  end if;
  if coalesce(trim(signer_name), '') = '' then
    raise exception 'Legal name is required';
  end if;
  if lower(trim(signer_email)) <> lower(
    (select profile.email::text from public.profiles profile where profile.id = auth.uid())
  ) then
    raise exception 'Signer email must match the signed-in account';
  end if;
  if (uploaded_signature_path is null) <> (uploaded_signature_file_name is null) then
    raise exception 'Uploaded signature metadata is incomplete';
  end if;
  if uploaded_signature_path is not null then
    if split_part(uploaded_signature_path, '/', 1) <> auth.uid()::text then
      raise exception 'Uploaded signature path is not owned by the signed-in user';
    end if;
    if not exists (
      select 1
      from storage.objects object
      where object.bucket_id = 'partner-signatures'
        and object.name = uploaded_signature_path
    ) then
      raise exception 'Uploaded signature file was not found';
    end if;
  end if;

  select *
  into document_row
  from public.agreement_documents document
  where document.document_type = target_document_type
    and document.is_active
    and document.content_url is not null
  limit 1;

  if document_row.id is null then
    raise exception 'The current % is not available yet', target_document_type;
  end if;
  if exists (
    select 1
    from public.partner_agreement_acceptances acceptance
    where acceptance.partner_id = partner
      and acceptance.agreement_document_id = document_row.id
  ) then
    raise exception 'This document has already been signed';
  end if;

  insert into public.partner_agreement_acceptances (
    partner_id,
    agreement_document_id,
    signer_name,
    signer_email,
    user_agent,
    signature_bucket,
    signature_path,
    signature_file_name
  )
  values (
    partner,
    document_row.id,
    trim(signer_name),
    lower(trim(signer_email)),
    browser_user_agent,
    case when uploaded_signature_path is null then null else 'partner-signatures' end,
    uploaded_signature_path,
    uploaded_signature_file_name
  );
  get diagnostics acceptance_inserted = row_count;

  select step.id
  into onboarding_step
  from public.onboarding_steps step
  where step.key = lower(target_document_type)
    and step.active
  limit 1;

  if onboarding_step is not null then
    insert into public.partner_onboarding_steps (
      partner_id, step_id, completed, completed_at, completed_by
    )
    values (partner, onboarding_step, true, now(), auth.uid())
    on conflict (partner_id, step_id) do update
    set completed = true,
        completed_at = coalesce(partner_onboarding_steps.completed_at, excluded.completed_at),
        completed_by = excluded.completed_by;
  end if;

  if acceptance_inserted > 0 then
    perform public.record_audit(
      target_document_type || ' Signed',
      'Onboarding',
      document_row.id::text,
      document_row.title,
      null,
      jsonb_build_object(
        'document_type', target_document_type,
        'version', document_row.version,
        'partner_id', partner,
        'signature_method',
          case when uploaded_signature_path is null then 'typed' else 'uploaded_image' end
      )
    );
  end if;

  return public.partner_agreements_complete(partner);
end;
$$;

revoke all on function public.accept_partner_agreement_document(text, text, text, text, text, text)
  from public, anon;
grant execute on function public.accept_partner_agreement_document(text, text, text, text, text, text)
  to authenticated;
