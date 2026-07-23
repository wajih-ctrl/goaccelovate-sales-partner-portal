-- Add private client-payment receipts and an explicit received time.

alter table public.client_payments
  add column if not exists received_time time without time zone,
  add column if not exists receipt_name text,
  add column if not exists receipt_bucket text,
  add column if not exists receipt_path text,
  add column if not exists receipt_type text,
  add column if not exists receipt_size bigint
    check (receipt_size is null or (receipt_size > 0 and receipt_size <= 10485760));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'payment-receipts',
  'payment-receipts',
  false,
  10485760,
  array['application/pdf', 'image/png', 'image/jpeg']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists storage_payment_receipts_insert_admin on storage.objects;
create policy storage_payment_receipts_insert_admin on storage.objects
for insert to authenticated
with check (
  bucket_id = 'payment-receipts'
  and public.is_admin()
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists storage_payment_receipts_select_admin on storage.objects;
create policy storage_payment_receipts_select_admin on storage.objects
for select to authenticated
using (bucket_id = 'payment-receipts' and public.is_admin());

drop policy if exists storage_payment_receipts_delete_admin on storage.objects;
create policy storage_payment_receipts_delete_admin on storage.objects
for delete to authenticated
using (bucket_id = 'payment-receipts' and public.is_admin());

drop function if exists public.record_client_payment_and_eligibility(
  uuid,numeric,date,text,text,text,text
);

create or replace function public.record_client_payment_and_eligibility(
  target_lead uuid,
  payment_amount numeric,
  payment_date date,
  payment_reference text,
  payment_method text,
  payment_type text,
  payment_time time without time zone,
  payment_notes text default null,
  receipt_name text default null,
  receipt_bucket text default null,
  receipt_path text default null,
  receipt_type text default null,
  receipt_size bigint default null
)
returns public.client_payments
language plpgsql
security definer
set search_path = public
as $$
declare
  lead_row public.leads;
  payment_row public.client_payments;
  commission_row public.commissions;
  release_amount numeric := 0;
begin
  if not public.is_admin() then raise exception 'Only Admin users can record client payments'; end if;
  if payment_type not in ('Advance','Final') then raise exception 'Payment type must be Advance or Final'; end if;
  if payment_amount is null or payment_amount <= 0 then raise exception 'Payment amount must be positive'; end if;
  if payment_date is null then raise exception 'Payment date is required'; end if;
  if payment_time is null then raise exception 'Payment time is required'; end if;
  if coalesce(trim(payment_reference),'') = '' then raise exception 'Payment reference is required'; end if;
  if coalesce(trim(payment_method),'') = '' then raise exception 'Payment method is required'; end if;

  if num_nonnulls(receipt_name, receipt_bucket, receipt_path, receipt_type, receipt_size) not in (0, 5) then
    raise exception 'Receipt metadata is incomplete';
  end if;
  if receipt_path is not null then
    if receipt_bucket <> 'payment-receipts' then raise exception 'Invalid receipt bucket'; end if;
    if receipt_type not in ('application/pdf', 'image/png', 'image/jpeg') then
      raise exception 'Unsupported receipt file type';
    end if;
    if receipt_size <= 0 or receipt_size > 10485760 then raise exception 'Invalid receipt file size'; end if;
    if receipt_path not like auth.uid()::text || '/%' then raise exception 'Invalid receipt path'; end if;
    if not exists (
      select 1
      from storage.objects object
      where object.bucket_id = receipt_bucket
        and object.name = receipt_path
    ) then
      raise exception 'Uploaded receipt was not found';
    end if;
  end if;

  select * into lead_row from public.leads where id = target_lead for update;
  if lead_row.id is null then raise exception 'Lead not found'; end if;
  if payment_type = 'Advance' and lead_row.stage::text not in (
    'Advance Confirmed','Sent to Product','Done by Product','Client Review','Under Revisions',
    'Final Payment Clearance','Final Handoff','Closed Won'
  ) then
    raise exception 'Advance payments can only be recorded from Advance Confirmed onward';
  end if;
  if payment_type = 'Final'
    and lead_row.stage::text not in ('Final Payment Clearance','Final Handoff','Closed Won') then
    raise exception 'Final payments can only be recorded from Final Payment Clearance onward';
  end if;
  if exists (
    select 1 from public.client_payments payment
    where payment.lead_id = target_lead
      and payment.payment_type = record_client_payment_and_eligibility.payment_type
      and payment.payment_cycle = lead_row.payment_cycle
  ) then
    raise exception '% payment has already been recorded for this payment cycle', payment_type;
  end if;

  insert into public.client_payments (
    lead_id, amount_received, received_date, received_time, payment_method, payment_reference,
    notes, trigger_commission_eligibility, payment_type, payment_cycle, created_by,
    receipt_name, receipt_bucket, receipt_path, receipt_type, receipt_size
  ) values (
    target_lead, payment_amount, payment_date, payment_time, trim(payment_method),
    trim(payment_reference), nullif(trim(payment_notes),''), true, payment_type,
    lead_row.payment_cycle, auth.uid(), receipt_name, receipt_bucket, receipt_path,
    receipt_type, receipt_size
  ) returning * into payment_row;

  if not exists (select 1 from public.commissions where lead_id = target_lead and kind = 'Deal') then
    insert into public.commissions (
      lead_id, partner_id, kind, rate, base_amount, amount, state, created_by
    )
    select
      lead_row.id,
      lead_row.partner_id,
      'Deal',
      profile.commission_rate,
      coalesce(lead_row.confirmed_value, lead_row.estimated_value),
      round(
        coalesce(lead_row.confirmed_value, lead_row.estimated_value)
          * profile.commission_rate / 100.0,
        2
      ),
      'On Hold',
      auth.uid()
    from public.partner_profiles profile
    where profile.id = lead_row.partner_id;
  end if;

  select * into commission_row
  from public.commissions
  where lead_id = target_lead and kind = 'Deal'
  order by created_at
  limit 1
  for update;

  if commission_row.id is not null then
    release_amount := case
      when payment_type = 'Final' then commission_row.amount - commission_row.eligible_amount
      else least(
        commission_row.amount - commission_row.eligible_amount,
        round(payment_amount * commission_row.rate / 100.0, 2)
      )
    end;
    release_amount := greatest(release_amount, 0);

    if release_amount > 0 then
      update public.commissions
      set
        eligible_amount = eligible_amount + release_amount,
        state = case
          when state in ('Payout Requested','Approved','Disputed') then state
          when paid_amount >= eligible_amount + release_amount then 'Paid'::public.commission_state
          else 'Unpaid'::public.commission_state
        end,
        updated_at = now()
      where id = commission_row.id;

      insert into public.notifications (partner_id, title, body, type, mandatory)
      values (
        lead_row.partner_id,
        case
          when payment_type = 'Advance' then 'Advance commission now payable'
          else 'Final commission now payable'
        end,
        lead_row.company_name || ': ' || release_amount
          || ' in commission is now available for payout.',
        'success',
        true
      );
    end if;
  end if;

  perform public.record_audit(
    'Client Payment Recorded',
    'Client Payments',
    payment_row.id::text,
    lead_row.company_name,
    null,
    jsonb_build_object(
      'type', payment_type,
      'amount', payment_amount,
      'date', payment_date,
      'time', payment_time,
      'reference', trim(payment_reference),
      'payment_cycle', lead_row.payment_cycle,
      'receipt_attached', receipt_path is not null,
      'commission_released', release_amount
    )
  );
  return payment_row;
end;
$$;

revoke all on function public.record_client_payment_and_eligibility(
  uuid,numeric,date,text,text,text,time without time zone,text,text,text,text,text,bigint
) from public, anon;
grant execute on function public.record_client_payment_and_eligibility(
  uuid,numeric,date,text,text,text,time without time zone,text,text,text,text,text,bigint
) to authenticated;
