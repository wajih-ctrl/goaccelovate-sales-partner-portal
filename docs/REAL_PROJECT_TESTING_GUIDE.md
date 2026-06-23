# GoAccelovate Portal Real Testing Guide

This portal now supports real Supabase Auth login. Demo role buttons are disabled by default and should only be turned on for local UI previews.

## 1. Configure Environment

Local file: `.env.local`

Required values:

```bash
VITE_SUPABASE_URL=https://okawbkodsnbixggvgvtx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
APP_URL=http://127.0.0.1:8081
VITE_ENABLE_DEMO_LOGIN=false
```

Notes:

- `VITE_SUPABASE_PUBLISHABLE_KEY` is safe for browser use.
- `SUPABASE_SERVICE_ROLE_KEY` is server-only. Never expose it in client code or screenshots.
- Restart the dev server after changing `.env.local`.

## 2. Create the First Super Admin

Before anyone can invite users, create one real Super Admin account:

```bash
node scripts/bootstrap-super-admin.mjs admin@example.com StrongPassword123 "Admin Name"
```

Use a real email address you can access. Password must be at least 12 characters.

After this runs, sign in at:

Open the local URL printed by Vite, then go to `/login`.

In this workspace right now, the dev server is running at:

```bash
http://127.0.0.1:8081/login
```

## 3. Invite Users From the Portal

Sign in as the real Super Admin, then go to:

```bash
/users
```

Click `Invite user`.

For an Admin:

- Enter full name and email.
- Select `Admin`.
- Send invitation.

For a Sales Partner:

- Enter full name and email.
- Select `Sales Partner`.
- Select tier.
- Send invitation.

Supabase sends the secure invitation email. The portal also records a pending invitation row for audit/tracking.

## 4. Accept an Invitation

The invited user opens the email link.

They will land on:

```bash
/invitation
```

They enter:

- Full name
- New password, minimum 12 characters
- Agreement checkbox

After acceptance, their profile becomes active and they are redirected to the dashboard.

## 5. Role Testing Checklist

Super Admin:

- Can access `/users`, `/settings`, `/audit-log`.
- Can invite Admins and Sales Partners.
- Can suspend/reactivate/delete users.
- Can view all leads, partners, commissions, payouts, reports.

Admin:

- Can access partners, leads, pipeline, commissions, payouts, client payments, reports.
- Cannot access `/users`, `/settings`, `/audit-log`.
- Can move leads through pipeline.
- Must enter reasons for Closed Lost, Disqualified, and Reopened.
- Can approve/reject payouts and manage commission states.

Sales Partner:

- Can submit leads.
- Can only see own leads, commissions, payouts, disputes, announcements, reports.
- Cannot access Kanban pipeline, all partners, users, settings, audit log, or client payment details.
- Can request payouts for eligible own commissions.
- Can open commission disputes.

## 6. Demo Mode

Demo buttons are hidden by default.

To temporarily show demo role buttons for local UI previews:

```bash
VITE_ENABLE_DEMO_LOGIN=true
```

Restart the dev server after changing that value.

For real testing and production:

```bash
VITE_ENABLE_DEMO_LOGIN=false
```

## 7. Production / Lovable Environment Variables

Set these in the deployment environment:

```bash
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
SUPABASE_SERVICE_ROLE_KEY
APP_URL
VITE_ENABLE_DEMO_LOGIN=false
```

Use the exact local or production domain for `APP_URL`, for example:

```bash
APP_URL=https://your-production-domain.com
```

Also add the same production domain to Supabase Auth redirect URLs.
