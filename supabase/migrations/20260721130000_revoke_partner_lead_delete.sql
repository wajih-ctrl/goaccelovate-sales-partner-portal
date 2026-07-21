-- PostgreSQL functions are executable by PUBLIC unless explicitly revoked.
-- Sales Partners may edit their leads but may never delete them.
revoke all on function public.delete_own_partner_lead(uuid) from public, anon, authenticated;
