-- Ensure the payout review CASE expression resolves to the payout_status enum.
create or replace function public.review_payout_request(
  target_payout uuid,
  approve_request boolean,
  rejection_reason text default null
)
returns public.payout_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  row_before public.payout_requests;
  row_after public.payout_requests;
begin
  if not public.is_admin() then raise exception 'Only Admin or Super Admin can review payouts'; end if;
  select * into row_before from public.payout_requests where id = target_payout for update;
  if row_before.id is null then raise exception 'Payout request not found'; end if;
  if row_before.status <> 'Pending' then raise exception 'Only pending payout requests can be reviewed'; end if;
  if not approve_request and coalesce(trim(rejection_reason), '') = '' then
    raise exception 'A rejection reason is required';
  end if;

  update public.payout_requests
  set status = case
        when approve_request then 'Approved'::public.payout_status
        else 'Rejected'::public.payout_status
      end,
      approved_by = case when approve_request then auth.uid() else null end,
      approved_at = case when approve_request then now() else null end,
      reject_reason = case when approve_request then null else trim(rejection_reason) end,
      updated_at = now()
  where id = target_payout
  returning * into row_after;

  update public.commissions commission
  set state = case
        when approve_request then 'Approved'::public.commission_state
        else 'Unpaid'::public.commission_state
      end,
      updated_at = now()
  from public.payout_request_items item
  where item.payout_request_id = target_payout and item.commission_id = commission.id;

  insert into public.notifications (partner_id, title, body, type, mandatory)
  values (
    row_before.partner_id,
    case when approve_request then 'Payout approved' else 'Payout rejected' end,
    case
      when approve_request then 'Your payout request for ' || row_before.amount || ' was approved and is awaiting external payment.'
      else 'Your payout request for ' || row_before.amount || ' was rejected. Reason: ' || trim(rejection_reason)
    end,
    case when approve_request then 'success' else 'warning' end,
    true
  );
  perform public.record_audit(
    case when approve_request then 'Payout Approved' else 'Payout Rejected' end,
    'Payouts', target_payout::text, 'Payout request',
    to_jsonb(row_before), to_jsonb(row_after)
  );
  return row_after;
end;
$$;

revoke all on function public.review_payout_request(uuid, boolean, text) from public, anon;
grant execute on function public.review_payout_request(uuid, boolean, text) to authenticated;
