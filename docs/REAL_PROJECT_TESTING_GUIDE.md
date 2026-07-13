# Real Project Testing Guide

Use this guide only against a non-production test dataset or approved production test accounts. The authoritative user workflow is in `PROJECT_USER_GUIDE.md`; the release checklist is in `BACKEND_RLS_AND_ROLE_FLOW_CHECKLIST.md`.

## Configure The Environment

Create `.env.local` without committing it:

```bash
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=
VITE_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
APP_URL=http://127.0.0.1:8081
VITE_APP_URL=http://127.0.0.1:8081
```

Only publishable/anon keys may use the `VITE_` prefix. The service-role key is server-only.

## Prepare Supabase

```bash
npx supabase login
npx supabase migration list
npx supabase db push --dry-run
npx supabase db push
```

Create the first Super Admin only when the project has none:

```bash
node scripts/bootstrap-super-admin.mjs admin@example.com StrongPassword123 "Admin Name"
```

Super Admin must publish the final Partner Agreement and NDA PDF URLs in Settings before inviting new Sales Partners.

## Test Accounts

Create one Super Admin, one Admin, and two Sales Partners with distinct partner profiles. Assign each partner a commission percentage. Accept invitations, sign the current Agreement and NDA, and then set the `RLS_*` credential variables documented in the checklist.

Run:

```bash
node scripts/verify-rls.mjs
```

Complete every browser and direct-RLS assertion in `BACKEND_RLS_AND_ROLE_FLOW_CHECKLIST.md`.

## Production Domains

Set `APP_URL` and `VITE_APP_URL` to the deployment domain. In Supabase Auth URL Configuration, set the Site URL and add every approved Vercel/custom-domain callback. Invitation and password recovery use the current request origin when it is a non-local domain, so the same build works on approved domains.

Never test with a personal access token or service-role key that has been pasted into chat, logs, screenshots, or client code. Revoke or rotate it first.
