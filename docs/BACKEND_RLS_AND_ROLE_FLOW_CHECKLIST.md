# Backend RLS and Role-Flow Verification

Run this against a real Supabase project with four real users:

- Super Admin
- Admin
- Sales Partner A
- Sales Partner B

## Automated RLS Check

Set:

```bash
SUPABASE_URL=
SUPABASE_ANON_KEY=
RLS_SUPER_ADMIN_EMAIL=
RLS_SUPER_ADMIN_PASSWORD=
RLS_ADMIN_EMAIL=
RLS_ADMIN_PASSWORD=
RLS_PARTNER_A_EMAIL=
RLS_PARTNER_A_PASSWORD=
RLS_PARTNER_B_EMAIL=
RLS_PARTNER_B_PASSWORD=
```

Run:

```bash
node scripts/verify-rls.mjs
```

The script verifies partners cannot read another partner's leads, commissions, payouts, documents,
client payments, private operational data, audit log, or update protected lead/commission fields.

## Manual Role Flow

- Super Admin login works.
- Admin login works.
- Partner A login works.
- Partner B login works.
- Suspended user is blocked.
- Super Admin invites Admin.
- Super Admin invites Sales Partner.
- Partner submits valid lead.
- Partner submits invalid lead form.
- Partner submits duplicate lead.
- Admin reviews duplicate lead.
- Duplicate reject requires reason.
- Duplicate override requires reason.
- Admin moves lead through pipeline.
- Partner sees own lead update.
- Partner cannot access another partner lead by URL.
- Partner cannot fetch another partner lead from Supabase.
- Admin logs discovery call.
- Partner sees visible discovery call.
- Partner cannot see private discovery call.
- Admin uploads lead attachment.
- Partner sees allowed attachment.
- Partner cannot see private/internal attachment.
- Admin marks Closed Won and enters confirmed deal value.
- Commission calculates.
- Admin logs client payment without eligibility trigger.
- Commission does not become payable yet.
- Admin triggers commission eligibility.
- Commission becomes payable.
- Partner requests payout.
- Admin approves payout.
- Admin records external payment.
- Partner sees payout as paid.
- Partner opens dispute.
- Admin resolves dispute.
- Admin sends announcement to Partner A only.
- Partner A sees announcement.
- Partner B does not see announcement.
- Admin exports report.
- Partner exports own report.
- Partner cannot export admin report.
- Super Admin views audit log.
- Partner cannot access audit log.
- Partner cannot read client payment details.
- Partner cannot read private admin notes.
