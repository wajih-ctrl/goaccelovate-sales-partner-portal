-- Agreement acceptance is the activation boundary for Sales Partner program data.
-- Keep profile, onboarding, legal documents, and own notifications available so
-- an invited partner can complete activation without seeing operational records.

create or replace function public.partner_has_program_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case public.current_user_role()
    when 'super_admin' then true
    when 'admin' then true
    when 'partner' then
      public.current_partner_id() is not null
      and public.partner_agreements_complete(public.current_partner_id())
    else false
  end
$$;

grant execute on function public.partner_has_program_access() to authenticated;

create or replace function public.is_partner_lead(lead uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.partner_has_program_access()
    and exists (
      select 1
      from public.leads l
      where l.id = lead
        and l.partner_id = public.current_partner_id()
    )
$$;

drop policy if exists partner_documents_select on public.partner_documents;
create policy partner_documents_select on public.partner_documents
  for select to authenticated
  using (
    public.is_admin()
    or (
      public.partner_has_program_access()
      and public.is_current_partner(partner_id)
      and not is_private
    )
  );

drop policy if exists leads_select on public.leads;
create policy leads_select on public.leads
  for select to authenticated
  using (
    public.is_admin()
    or (public.partner_has_program_access() and public.is_current_partner(partner_id))
  );

drop policy if exists leads_insert on public.leads;
create policy leads_insert on public.leads
  for insert to authenticated
  with check (
    public.is_admin()
    or (public.partner_has_program_access() and public.is_current_partner(partner_id))
  );

drop policy if exists commissions_select on public.commissions;
create policy commissions_select on public.commissions
  for select to authenticated
  using (
    public.is_admin()
    or (public.partner_has_program_access() and public.is_current_partner(partner_id))
  );

drop policy if exists commission_bonuses_select on public.commission_bonuses;
create policy commission_bonuses_select on public.commission_bonuses
  for select to authenticated
  using (
    public.is_admin()
    or (public.partner_has_program_access() and public.is_current_partner(partner_id))
  );

drop policy if exists payout_requests_select on public.payout_requests;
create policy payout_requests_select on public.payout_requests
  for select to authenticated
  using (
    public.is_admin()
    or (public.partner_has_program_access() and public.is_current_partner(partner_id))
  );

drop policy if exists payout_requests_insert_partner on public.payout_requests;
create policy payout_requests_insert_partner on public.payout_requests
  for insert to authenticated
  with check (public.partner_has_program_access() and public.is_current_partner(partner_id));

drop policy if exists payout_items_select on public.payout_request_items;
create policy payout_items_select on public.payout_request_items
  for select to authenticated
  using (
    public.is_admin()
    or (
      public.partner_has_program_access()
      and exists (
        select 1
        from public.payout_requests request
        where request.id = payout_request_id
          and public.is_current_partner(request.partner_id)
      )
    )
  );

drop policy if exists payout_items_insert_partner on public.payout_request_items;
create policy payout_items_insert_partner on public.payout_request_items
  for insert to authenticated
  with check (
    public.partner_has_program_access()
    and exists (
      select 1
      from public.payout_requests request
      join public.commissions commission on commission.id = commission_id
      where request.id = payout_request_id
        and public.is_current_partner(request.partner_id)
        and commission.partner_id = request.partner_id
        and commission.state = 'Unpaid'
    )
  );

drop policy if exists announcements_select on public.announcements;
create policy announcements_select on public.announcements
  for select to authenticated
  using (
    public.is_admin()
    or (public.partner_has_program_access() and public.partner_can_read_announcement(id))
  );

drop policy if exists announcement_reads_select on public.announcement_reads;
create policy announcement_reads_select on public.announcement_reads
  for select to authenticated
  using (
    public.is_admin()
    or (public.partner_has_program_access() and public.is_current_partner(partner_id))
  );

drop policy if exists announcement_reads_insert_partner on public.announcement_reads;
create policy announcement_reads_insert_partner on public.announcement_reads
  for insert to authenticated
  with check (public.partner_has_program_access() and public.is_current_partner(partner_id));

-- Notification feeds are recipient-scoped. Admin access to operational tables
-- does not imply that every admin should see every partner's personal alerts.
drop policy if exists notifications_select on public.notifications;
create policy notifications_select on public.notifications
  for select to authenticated
  using (
    recipient_id = auth.uid()
    or (partner_id is not null and public.is_current_partner(partner_id))
  );

drop policy if exists notifications_update_read on public.notifications;
create policy notifications_update_read on public.notifications
  for update to authenticated
  using (
    recipient_id = auth.uid()
    or (partner_id is not null and public.is_current_partner(partner_id))
  )
  with check (
    recipient_id = auth.uid()
    or (partner_id is not null and public.is_current_partner(partner_id))
  );

drop policy if exists storage_partner_documents_read on storage.objects;
create policy storage_partner_documents_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'partner-documents'
    and (
      public.is_admin()
      or (
        public.partner_has_program_access()
        and exists (
          select 1
          from public.partner_documents document
          where document.storage_bucket = bucket_id
            and document.storage_path = name
            and public.is_current_partner(document.partner_id)
            and not document.is_private
        )
      )
    )
  );

drop policy if exists storage_lead_attachments_insert on storage.objects;
create policy storage_lead_attachments_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'lead-attachments'
    and (
      public.is_admin()
      or (
        public.partner_has_program_access()
        and name like auth.uid()::text || '/%'
      )
    )
  );
