-- Keep contact phone duplicate detection index-backed as the lead table grows.
create index if not exists leads_contact_phone_digits_idx
on public.leads ((regexp_replace(coalesce(contact_phone, ''), '[^0-9]+', '', 'g')));
