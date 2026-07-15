# GoAccelovate Global Partner Program Guide

This guide explains the approved portal workflow for Super Admins, Admins, and Sales Partners.

## Roles And Access

- Sales Partners access only their own profile, leads, visible files and calls, commissions, payout history, and targeted announcements.
- Admins manage Sales Partners, operational leads, pipeline stages, calls, files, payments, commissions, payouts, announcements, and operational reports.
- Super Admins have Admin access plus Admin invitations, account lifecycle controls, program settings, agreement publishing, and the audit log.

Authentication uses real Supabase Auth accounts. No demo login is included in production code.

## Invitations And Agreements

Admin and Super Admin can invite a Sales Partner. A commission percentage is required before sending the invitation. Only Super Admin can invite an Admin, revoke/delete an invitation, change roles, suspend, reinstate, or deactivate an account.

Sending a Sales Partner invitation countersigns the Agreement and NDA with the inviting Admin or Super Admin's name, role, and invitation date. This immutable signer snapshot remains part of the partner's generated documents even if the inviter's profile is later renamed.

New Sales Partners land on their dashboard after signing in. Onboarding remains available in the sidebar, while lead submission stays locked until the current Partner Agreement and NDA are signed:

1. Super Admin publishes secure PDF URLs in Settings.
2. The invitation recipient sets a password and opens onboarding.
3. The partner reads both documents, enters their legal name, confirms the e-signature, and signs.
4. The portal records the user, partner, document version, signer name, and timestamp, then automatically completes the Agreement and NDA onboarding steps.
5. The partner reviews and acknowledges the GoAccelovate Welcome Kit in Onboarding. The acknowledgement is stored and audited.
6. Publishing a new document version requires affected partners to sign again and automatically reopens the two legal onboarding steps.

The profile onboarding step is also automatic. It completes when the partner has supplied their name, phone, country, city, and professional bio. Country and city use searchable global lists; email remains managed by the authenticated account.

Do not invite production partners before final Agreement and NDA PDFs are published.

## Partner Lead Workflow

Partners open `My Leads` and use the top-right `Submit Lead` button. The form includes company, contact, job title, email, optional phone, client LinkedIn URL, country, industry, estimated value and currency, and a 50-character to 1,000-word relationship message. Allowed attachments can be uploaded.

Validation and duplicate detection run server-side:

- Invalid or incomplete forms are not saved.
- A matching contact email or normalized phone number is rejected before a lead record is created. Company name alone is not treated as a duplicate.
- A valid lead enters `Identified Opportunity` immediately and Admin users are notified.

Partners can view their leads as a table or Kanban board, edit estimated value before the commercial stages, move only partner-controlled stages, add public updates, and delete their own lead while no commission exists.

## Pipeline

The fixed stages are:

1. Identified Opportunity
2. Outreach Started
3. In Communication
4. Discovery Call
5. On Hold
6. Contract Sent
7. Advance Pending
8. Advance Confirmed
9. Sent to Product
10. Done by Product
11. Client Review
12. Under Revisions
13. Final Payment Clearance
14. Final Handoff
15. Closed Won
16. Closed Lost

Partners control the first four stages and can mark a lead Closed Lost. Admin controls later stages and can also mark Closed Lost. Putting a lead On Hold records its previous stage; resuming returns it to that stage. Calls and their attachments are managed inside lead detail, not on a separate screen.

From Contract/Proposal Sent onward, Admin can update the commercial value. Closing a lead as won uses the confirmed deal value for commission calculation.

## Payments And Commissions

Client payment details are Admin-only. Admin records either:

- `Advance` from Advance Confirmed onward.
- `Final` from Final Payment Clearance onward.

Recording an eligible payment releases the proportional commission amount. An advance payment releases only its share; the final payment releases the remaining share up to the calculated commission total. Partners see earned, payable/pending, and paid commission amounts, but never the client's payment records.

The partner selects payable commission items in `My Commissions` and requests one payout. Admin approves or rejects it with a reason. After external payment, Admin records the exact approved amount, date, method, and transaction reference. The commission paid balance, payout history, audit entry, and partner notification update atomically.

The complete browser and numerical verification procedure is documented in
`PAYMENT_AND_PAYOUT_TEST_GUIDE.md`.

Commission disputes and the separate payout navigation are not part of this program version.

## Announcements And Reports

Announcements can target all partners, all users, Admins, Super Admins, regions, or selected partners. RLS determines who can read each announcement.

Admin and Super Admin reports include operational pipeline, partner, commission, payout, and client revenue data. Super Admin alone can access the audit log. Partner export actions are intentionally removed; partner data remains available in their own portal views.

## Files And Privacy

Supabase Storage buckets are private. Metadata is created only after a successful binary upload. Supported formats and size limits are validated before upload.

- Partner-visible files can be read only by the owning partner and Admin users.
- Internal/private files are Admin-only.
- Partners cannot read files for another partner's lead.
- Deleting a partner-owned lead also deletes its uploaded files when permitted.
- Signed download URLs are short-lived.

## Account Lifecycle

Suspended and deactivated accounts are rejected by the portal after authentication. Super Admin lifecycle changes create audit entries and mandatory in-app notifications. Sign-out always clears the session and returns to login.

Supabase Auth sends invitation and password-reset emails. Branded GoAccelovate templates are stored in `supabase/templates`, with a clear purpose, action button, security guidance, logo header, and website footer. Hosted Supabase projects require custom SMTP or a plan that permits auth-template customization before those designs can be activated. General announcement and event emails also require a configured server-side provider such as Resend or SMTP; in-app notifications remain the authoritative delivery channel until that provider is configured and tested.

## Production Configuration

Required browser variables:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_SUPABASE_ANON_KEY=
```

Required server-only variables:

```bash
SUPABASE_SERVICE_ROLE_KEY=
APP_URL=
```

Never place `SUPABASE_SERVICE_ROLE_KEY` in a `VITE_` variable or frontend file. Supabase Site URL and Redirect URLs must include every production/custom domain used for invitation and password recovery.

## Release Verification

Run before each production release:

```bash
npm run build
npx tsc --noEmit
npm run lint
npx supabase migration list
npx supabase db push --dry-run
node scripts/verify-rls.mjs
```

Then complete `docs/BACKEND_RLS_AND_ROLE_FLOW_CHECKLIST.md` with real accounts. Rotate any personal access token or service-role key that has appeared in chat, logs, screenshots, or browser code.
