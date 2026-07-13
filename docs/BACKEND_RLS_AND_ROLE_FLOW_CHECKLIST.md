# Production RLS And Role-Flow Verification

Use a real Super Admin, Admin, Sales Partner A, and Sales Partner B. Record evidence and any failing Supabase request before release.

## Automated RLS Check

Set `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and the `RLS_*_EMAIL` / `RLS_*_PASSWORD` variables documented by `scripts/verify-rls.mjs`, then run:

```bash
node scripts/verify-rls.mjs
```

## Authentication And Invitations

- [ ] All four roles can sign in and sign out returns to `/login`.
- [ ] Suspended and deactivated accounts are blocked; reinstated account works.
- [ ] Admin can invite and view Sales Partners but cannot invite Admins or change lifecycle state.
- [ ] Super Admin can invite Admin and Sales Partner, revoke an invite, and manage account lifecycle.
- [ ] Sales Partner invitation requires commission percentage.
- [ ] Invite and password-reset links use the active production/custom domain.
- [ ] New partner is restricted to onboarding until current Agreement and NDA are signed.
- [ ] Publishing a new document version requires re-signing.

## Leads And Pipeline

- [ ] Partner submits a valid lead and it enters Identified Opportunity without approval.
- [ ] Missing/invalid fields remain unsaved with clear errors.
- [ ] Duplicate company or email is immediately Duplicate Rejected and Admin is notified.
- [ ] Country, industry, LinkedIn, value, message limit, and attachment validation work.
- [ ] My Leads table/Kanban and all tables scroll horizontally on phone/tablet widths.
- [ ] Partner can move only the first four stages or mark Closed Lost.
- [ ] Admin can move operational stages; On Hold resumes to the recorded previous stage.
- [ ] Partner can delete an own lead without commissions and cannot delete another partner's lead.
- [ ] Admin updates commercial value and closes won with confirmed value.

## Calls, Storage, Payments, And Payouts

- [ ] Admin records a public and private discovery call inside lead detail.
- [ ] Owning partner sees the public call and never sees the private call.
- [ ] Partner/admin upload, view, and permitted delete work for real Storage files.
- [ ] Owning partner sees public files but not internal files; Partner B sees neither.
- [ ] Advance payment is accepted only from Advance Confirmed onward.
- [ ] Final payment is accepted only from Final Payment Clearance onward.
- [ ] Advance releases proportional commission; final releases remaining eligible commission.
- [ ] Partner cannot read client payment rows or details.
- [ ] Partner requests only eligible unpaid commission; duplicate/ineligible request fails.
- [ ] Admin approve/reject reason and external payment details work; partner receives notification.

## Announcements, Reports, And Audit

- [ ] Selected-partner announcement is visible to Partner A and not Partner B.
- [ ] Region and role audiences resolve correctly.
- [ ] Admin operational reports contain allowed data and KPIs.
- [ ] Partner has no admin report/export or audit-log access.
- [ ] Super Admin can view/export audit log.
- [ ] Stage, payment, payout, agreement, settings, and lifecycle actions create audit entries.

## Direct RLS Assertions

- [ ] Partner cannot select another partner's lead, commission, payout, document, attachment, or call.
- [ ] Partner cannot select private notes, client payments, historical disputes, or audit log.
- [ ] Partner cannot directly update protected lead stage/status, commission, payout, invitation, settings, or profile-role fields.
- [ ] Admin has operational access but not Super Admin-only lifecycle/settings actions.
- [ ] Storage object policies match metadata visibility and ownership.
- [ ] No service-role key appears in browser bundles, source maps, or any `VITE_` variable.

Release is blocked until every applicable item passes against the same Supabase project used by production.
