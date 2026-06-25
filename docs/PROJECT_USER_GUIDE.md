# GoAccelovate GTPP Sales Partner Portal Guide

This guide explains how the portal works for Super Admins, Admins, and Sales Partners.

## Purpose

The portal is a private sales partner system for managing partner accounts, submitted leads, pipeline progress, commissions, payouts, disputes, announcements, documents, reports, settings, and audit history.

The core rule is role separation:

- Sales Partners can only access their own profile, leads, commissions, payouts, allowed documents, visible discovery calls, visible announcements, and own reports.
- Admins can manage operational sales activity, pipeline, commissions, payouts, client payment eligibility, lead attachments, discovery calls, announcements, and reports.
- Super Admins can do everything Admins can do, plus user lifecycle management, settings, audit log access, and Super Admin-only reports.

## Login And Accounts

Users sign in with Supabase Auth in real mode. Demo login is only available when `VITE_ENABLE_DEMO_LOGIN=true`.

Super Admin controls access from User Management:

1. Open `User Management`.
2. Click `Invite user`.
3. Enter name, email, role, and partner tier if inviting a Sales Partner.
4. Supabase sends the invite email.
5. The portal records the invitation for tracking.
6. The invited user accepts the email invite and sets their password.

Revoking an invitation removes the pending invitation from Supabase and records an audit entry. Pending partner profiles created by the invite are deactivated if the invite is revoked before acceptance.

Suspended or deactivated users are blocked by the auth/profile status check.

## Sales Partner Workflow

Sales Partners use the portal to manage their own relationship with GoAccelovate.

Main partner actions:

- View dashboard metrics for their own leads, pipeline value, commissions, payout status, recent lead activity, and announcements.
- Open `My Profile` to update basic personal and professional information.
- Submit a lead using `Submit Lead`.
- Upload allowed lead attachments during submission when enabled by the form.
- View their own lead list and lead details.
- Add partner-visible updates to their own leads.
- View visible discovery calls connected to their own leads.
- View their own commission statement.
- Request payout for payable commissions.
- Open a commission dispute.
- Read announcements targeted to them.
- Export their own allowed reports.

Partners cannot:

- See another partner's leads, commissions, payouts, documents, private notes, private discovery calls, client payment details, admin reports, or audit log.
- Change lead stage or lead status.
- Change commission fields.
- Manage users, settings, pipeline stages, payouts, or admin-only documents.

## Admin Workflow

Admins manage sales operations after partners submit leads.

Main admin actions:

- View all operational leads and pipeline status.
- Use Pipeline Kanban or Pipeline List to move leads through stages.
- Review duplicate leads and provide required reasons for reject or override.
- Add discovery call records and mark them public or private.
- Upload lead attachments and choose visibility.
- Move a lead to Closed Won and enter confirmed deal value.
- Review calculated commission records.
- Log client payments.
- Explicitly select `Trigger commission eligibility` when a payment should make the commission payable.
- Review, approve, reject, and record external payout payments.
- Resolve commission disputes.
- Publish announcements to all partners, tiers, regions, or selected partners.
- Export role-safe operational reports.

Admins cannot perform Super Admin-only lifecycle actions such as changing privileged roles, suspending Admin users if blocked by policy, or viewing the Super Admin audit log when the route/RLS denies it.

## Super Admin Workflow

Super Admins control platform administration.

Main Super Admin actions:

- Invite Admins and Sales Partners.
- View pending invitations.
- Revoke pending invitations.
- Change roles where allowed.
- Suspend, reinstate, or deactivate accounts.
- Manage partner tiers and commission rates.
- Manage global settings.
- Confirm setting changes that affect records.
- View and export the audit log.
- Run all Admin operational workflows.

Every major account, setting, commission, payout, dispute, and pipeline action should create an audit log entry.

## Lead Lifecycle

1. Sales Partner submits a lead.
2. Server-side validation checks required fields and duplicate risk.
3. Valid leads enter the pipeline without manual approval.
4. Duplicate-risk leads are flagged for Admin review.
5. Admin either rejects as duplicate or overrides and allows the lead, with a required reason.
6. Admin moves the lead through pipeline stages.
7. Partner can track only their own lead status.
8. Closed Won creates or updates commission records.

Pipeline stages and labels are configurable by Super Admin settings.

## Commissions And Payouts

Commission is calculated from the confirmed deal value and the partner commission rate.

Client payments do not automatically make a commission payable. Admin must explicitly trigger commission eligibility while logging the client payment, or use the eligibility action provided in the payment/commission workflow. This protects the business while installment rules are still evolving.

Partner payout flow:

1. Partner sees payable commissions.
2. Partner requests payout.
3. Admin approves or rejects the payout.
4. Finance pays externally.
5. Admin records external payment details.
6. Partner sees the payout as paid.

Partners never see client payment details.

## Documents And Storage

Supabase Storage is used for real file uploads.

Supported file areas:

- Partner documents
- Lead attachments
- Discovery call attachments

Visibility rules:

- Partner-visible files can be viewed by the owning partner and Admin/Super Admin.
- Private/internal files are Admin/Super Admin only.
- Partners cannot access files attached to another partner's records.
- File metadata is stored only after upload succeeds.

Storage bucket policies must remain aligned with the RLS rules. Do not expose service-role keys in frontend code.

## Announcements And Notifications

In-app notifications are stored in Supabase and shown inside the portal.

Real email status:

- Supabase Auth invite emails are sent by Supabase Auth.
- Supabase password reset emails are sent by Supabase Auth.
- General notification emails and announcement emails need a server-side email provider such as Resend or SMTP before they are production-live.
- Add `RESEND_API_KEY` and `NOTIFICATION_FROM_EMAIL` server-side when an outbound email sender is implemented.
- Critical account and payout events should remain mandatory and should not be disabled by user preferences once email delivery is wired.

Until an outbound provider is configured and tested, do not claim that general notification emails are fully live.

## Reports

Reports must be role-safe.

Admin/Super Admin reports:

- All Partners Overview
- Full Pipeline Report
- Commission Liability Report
- Payout History
- Client Revenue Attribution

Partner reports:

- My Leads Report
- My Commission Statement

Partners must only export their own data. Super Admin can export the audit log. Admin-wide data must never be generated for a partner user.

## Settings

Super Admin settings include:

- Commission rates by tier
- Pipeline stage labels
- Supported currencies
- Partner tier labels
- Lead staleness threshold
- Payout window
- Onboarding checklist steps
- Invitation expiry

Settings that affect existing or future records require confirmation before saving and must create an audit log entry with old and new values.

## Security Checklist

Production readiness depends on these checks passing:

- No `SUPABASE_SERVICE_ROLE_KEY` in frontend/browser code.
- RLS prevents partners from reading or updating other partners' data.
- Partners cannot read client payments, private notes, private/internal files, admin reports, or audit log.
- Admin can access operational data.
- Super Admin can access all administrative data.
- Storage signed URLs respect visibility and ownership.
- Suspended and deactivated users cannot continue using the portal.
- Demo mode is disabled in production.

## Local Development

Common commands:

```bash
npm install
npm run dev
npm run build
npx tsc --noEmit
npx eslint <changed-files>
npx supabase migration list
npx supabase db push --dry-run
node scripts/verify-rls.mjs
```

Required environment variables:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
APP_URL=
VITE_ENABLE_DEMO_LOGIN=false
```

Optional future email variables:

```bash
RESEND_API_KEY=
NOTIFICATION_FROM_EMAIL=
```

## Production Notes

Rotate any Supabase personal access token or service-role key that has been pasted into chat, logs, screenshots, or browser-visible code.

Service-role keys belong only on the server. The frontend must use publishable or anon keys plus RLS.

Before launch, complete browser role-flow testing with real Super Admin, Admin, Sales Partner A, and Sales Partner B accounts.
