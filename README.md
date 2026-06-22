# GoAccelovate Sales Partner Portal

Frontend prototype for the GoAccelovate GTPP Sales Partner Portal.

This app is a Lovable-generated TanStack Start prototype built with React 19 and Vite. Version 1 is intentionally frontend-only: all data is mocked in local React state, with simulated role permissions, CRUD actions, exports, payouts, commissions, announcements, notifications, audit entries, and validation flows.

## Current Status

- Prototype-only frontend
- No database connected yet
- No real backend storage
- No Supabase code is currently wired into the app
- No real payment, email, CRM, e-signature, or file-storage integration

Phase 2 will connect the app to Supabase after the frontend flows are approved.

## Tech Stack

- TanStack Start
- React 19
- Vite
- TypeScript
- Tailwind CSS
- Radix UI primitives
- npm

## Local Setup

Install dependencies:

```bash
npm ci
```

Start the development server:

```bash
npm run dev
```

Open:

```text
http://127.0.0.1:5173
```

Build for production:

```bash
npm run build
```

## Demo Roles

Use the role buttons on the login screen:

- Super Admin: full access, user management, settings, audit log
- Admin: partners, leads, pipeline, discovery calls, commissions, payouts, reports
- Sales Partner: own profile, onboarding, lead submission, own leads, commissions, payouts, announcements, reports

## Implemented Prototype Modules

- Role-based dashboards
- Partner profiles and onboarding
- Lead submission with validation and duplicate checks
- Admin pipeline Kanban with draggable cards
- Admin pipeline list with filters
- Lead detail timeline, comments, attachments, discovery calls
- Commission tracking, overrides, manual retainer and bonus lines
- Payout requests, approvals, rejections, payment recording
- Client payment logging with simulated commission eligibility
- Commission disputes and discussion threads
- Notifications and targeted announcements
- Reports and CSV/PDF-stub exports
- Super Admin settings
- Super Admin audit log

## Project Structure

```text
src/
  components/      Shared UI and layout components
  lib/             Mock data, auth, store, helpers
  routes/          TanStack route files
```

Important frontend state files:

- `src/lib/mock-data.ts`
- `src/lib/store.tsx`
- `src/lib/auth.tsx`

## Phase 2: Supabase Backend Connectivity Plan

Do not connect Supabase until the prototype flows are approved. The recommended Phase 2 approach is to replace the mock store incrementally, module by module, while preserving the current UI behavior.

### 1. Create Supabase Project

In Supabase:

1. Create a new project.
2. Save the project URL.
3. Save the anon public key.
4. Keep the service role key private and server-only.

### 2. Add Environment Variables

Create a local `.env.local` file:

```bash
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Never commit real Supabase keys.

### 3. Install Supabase Client

When Phase 2 begins:

```bash
npm install @supabase/supabase-js
```

Create:

```text
src/lib/supabase.ts
```

Example:

```ts
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

### 4. Suggested Database Tables

Core identity and roles:

- `profiles`
- `invitations`
- `partner_profiles`
- `partner_documents`

Leads and activity:

- `leads`
- `lead_activity`
- `lead_attachments`
- `discovery_calls`

Commercial tracking:

- `commissions`
- `payouts`
- `payout_commissions`
- `client_payments`
- `commission_disputes`
- `commission_dispute_messages`

Communications and operations:

- `announcements`
- `announcement_reads`
- `notifications`
- `settings`
- `audit_log`

### 5. Required Access Rules

Use Supabase Row Level Security for every user-facing table.

Minimum rules:

- Super Admin can read and manage everything.
- Admin can manage operational data, but cannot manage global settings, user deletion, or audit log visibility unless explicitly allowed.
- Partner can only read and update their own partner profile basics.
- Partner can only see their own leads, commissions, payouts, disputes, discovery-call records, announcements, and documents.
- Partner cannot see other partners' data.
- Partner cannot update lead stage, lead status, commission rate, confirmed deal value, payout approval, client payment records, settings, or audit records.
- Audit log is append-only and Super Admin-only.

### 6. Supabase Auth Flow

The portal should remain invitation-only.

Recommended flow:

1. Super Admin creates an invitation.
2. Supabase Auth invite email is sent.
3. On first login, a `profiles` row is created or completed.
4. Role is stored in `profiles.role`.
5. Partner accounts are linked to `partner_profiles.id`.

Do not allow open public sign-up.

### 7. Storage Buckets

Suggested private buckets:

- `lead-attachments`
- `partner-documents`
- `discovery-call-files`

Use signed URLs for downloads. Partners should only receive signed URLs for files they are allowed to view.

### 8. Migration Order

Recommended order:

1. Auth and role loading
2. Partner profiles
3. Leads and lead activity
4. Discovery calls and attachments
5. Commissions
6. Payouts and client payments
7. Disputes
8. Announcements and notifications
9. Reports
10. Settings and audit trail

### 9. Keep During Migration

Keep the existing mock data and store available behind a development flag until each module is fully migrated. This makes it easier to compare Supabase-backed behavior against the approved prototype.

## Git / Lovable Note

This project is connected to Lovable. Avoid force-pushing or rewriting published history on branches that sync with Lovable.
