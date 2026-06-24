drop policy if exists storage_lead_attachments_insert on storage.objects;
create policy storage_lead_attachments_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'lead-attachments'
    and (
      public.is_admin()
      or name like auth.uid()::text || '/%'
    )
  );

drop policy if exists storage_partner_documents_write_admin on storage.objects;
create policy storage_partner_documents_write_admin on storage.objects
  for all to authenticated
  using (
    bucket_id = 'partner-documents'
    and public.is_admin()
    and (name like auth.uid()::text || '/%' or public.is_super_admin())
  )
  with check (
    bucket_id = 'partner-documents'
    and public.is_admin()
    and (name like auth.uid()::text || '/%' or public.is_super_admin())
  );

drop policy if exists storage_discovery_files_write_admin on storage.objects;
create policy storage_discovery_files_write_admin on storage.objects
  for all to authenticated
  using (
    bucket_id = 'discovery-call-files'
    and public.is_admin()
    and (name like auth.uid()::text || '/%' or public.is_super_admin())
  )
  with check (
    bucket_id = 'discovery-call-files'
    and public.is_admin()
    and (name like auth.uid()::text || '/%' or public.is_super_admin())
  );

create or replace function public.review_duplicate_lead(
  lead_id uuid,
  allow_duplicate boolean,
  reason text
)
returns public.leads
language plpgsql
security definer
set search_path = public
as $$
declare
  updated public.leads;
begin
  if not public.is_admin() then
    raise exception 'Only Admins can review duplicate leads';
  end if;

  if coalesce(trim(reason), '') = '' then
    raise exception 'Duplicate review reason is required';
  end if;

  update public.leads
  set
    status = case when allow_duplicate then 'Active'::public.lead_status else 'Duplicate Rejected'::public.lead_status end,
    duplicate_reason = trim(reason),
    duplicate_reviewed_by = auth.uid(),
    duplicate_reviewed_at = now(),
    last_activity_at = now()
  where id = lead_id
    and status = 'Duplicate Under Review'
  returning * into updated;

  if updated.id is null then
    raise exception 'Duplicate lead not found';
  end if;

  insert into public.lead_activity_log (lead_id, type, actor_id, actor_name, text, is_private)
  select
    updated.id,
    'system',
    auth.uid(),
    coalesce(p.full_name, p.email),
    case when allow_duplicate then 'Duplicate override allowed: ' else 'Duplicate rejected: ' end || trim(reason),
    false
  from public.profiles p
  where p.id = auth.uid();

  perform public.record_audit(
    case when allow_duplicate then 'Duplicate Override Approved' else 'Duplicate Rejected' end,
    'Leads',
    updated.id::text,
    updated.company_name,
    null,
    jsonb_build_object('reason', trim(reason))
  );

  return updated;
end;
$$;

grant execute on function public.review_duplicate_lead(uuid, boolean, text) to authenticated;

create or replace function public.trigger_commission_eligibility(
  lead_id uuid,
  payment_reference text
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  changed_count integer;
  lead_row public.leads;
begin
  if not public.is_admin() then
    raise exception 'Only Admins can trigger commission eligibility';
  end if;

  update public.commissions
  set state = 'Unpaid'
  where commissions.lead_id = trigger_commission_eligibility.lead_id
    and state = 'On Hold';

  get diagnostics changed_count = row_count;

  select * into lead_row from public.leads where id = trigger_commission_eligibility.lead_id;

  if changed_count > 0 then
    insert into public.notifications (partner_id, title, body, type, mandatory)
    values (
      lead_row.partner_id,
      'Commission now payable',
      lead_row.company_name || ' released for payout after client payment.',
      'success',
      true
    );

    perform public.record_audit(
      'Commission Eligibility Triggered',
      'Commissions',
      trigger_commission_eligibility.lead_id::text,
      payment_reference,
      null,
      jsonb_build_object('released_commissions', changed_count)
    );
  end if;

  return changed_count;
end;
$$;

grant execute on function public.trigger_commission_eligibility(uuid, text) to authenticated;
