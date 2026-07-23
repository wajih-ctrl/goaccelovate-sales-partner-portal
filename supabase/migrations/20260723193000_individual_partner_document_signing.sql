-- Allow Sales Partners to sign the active Agreement and NDA independently.

create or replace function public.accept_partner_agreement_document(
  target_document_type text,
  signer_name text,
  signer_email text,
  browser_user_agent text default null
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

  insert into public.partner_agreement_acceptances (
    partner_id,
    agreement_document_id,
    signer_name,
    signer_email,
    user_agent
  )
  values (
    partner,
    document_row.id,
    trim(signer_name),
    lower(trim(signer_email)),
    browser_user_agent
  )
  on conflict (partner_id, agreement_document_id) do nothing;
  get diagnostics acceptance_inserted = row_count;

  select step.id
  into onboarding_step
  from public.onboarding_steps step
  where step.key = lower(target_document_type)
    and step.active
  limit 1;

  if onboarding_step is not null then
    insert into public.partner_onboarding_steps (
      partner_id,
      step_id,
      completed,
      completed_at,
      completed_by
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
        'partner_id', partner
      )
    );
  end if;

  return public.partner_agreements_complete(partner);
end;
$$;

revoke all on function public.accept_partner_agreement_document(text, text, text, text)
  from public, anon;
grant execute on function public.accept_partner_agreement_document(text, text, text, text)
  to authenticated;
