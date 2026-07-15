# Client Payment And Payout Test Guide

This guide verifies the production flow with one Admin and one Sales Partner. Use an approved test
deal and references that clearly identify the test. Client payment details are Admin-only. Sections
1-5 follow the stated business requirements. Additional portal safeguards and engineering checks are
listed separately at the end and are not requirement acceptance criteria.

## Test Values

Use a deal value of `$1,000` and a partner commission rate of `10%`.

- Total commission: `$100`
- Advance received: `$200`
- Commission released by advance: `$20`
- Final payment received: `$800`
- Remaining commission released by final payment: `$80`
- Total received: `$1,000`
- Outstanding client balance: `$0`

## 1. Prepare The Deal

1. Sign in as Admin or Super Admin.
2. Open `Pipeline` and select the test lead.
3. Move it to `Advance Confirmed`.
4. Confirm the deal value is `$1,000` and the partner rate is `10%`.

Expected:

- A Sales Partner cannot move the lead into `Advance Confirmed`.
- An Advance payment cannot be recorded before this stage.

## 2. Record The Advance

1. As Admin, open `Client Payments`.
2. Select `Record payment`.
3. Choose the test deal and `Advance`.
4. Enter `$200`, the received date, and a unique payment reference.
5. Submit the form.

The current portal also captures a client payment method for internal reconciliation. That additional
field is present in the application but is not part of the stated acceptance requirement.

Expected:

- The payment appears in the payment table.
- Deal payment summary shows Advance `$200`, Final `$0`, Total `$200`, Outstanding `$800`.
- The partner's payable commission becomes `$20`.
- The partner is notified that commission has become payable.

## 3. Request And Process The Advance Commission Payout

1. Sign in as the Sales Partner and open `My Commissions`.
2. Confirm `Triggered earnings` includes `$20` and the test commission shows `$20` payable.
3. Select `Request Payout`, choose the test commission, and submit.
4. Confirm the request appears in `Payout history` on the same page.
5. Sign in as Admin and open `Payout Requests`.
6. Confirm the new request is `$20` and approve it.
7. Select `Mark paid`, which is the current UI action for recording the external payment.
8. Enter the amount, payment date, payment method, and transaction reference.

Expected:

- Admin receives the payout request notification and can review it.
- The request is approved before external payment details can be recorded.
- The partner is notified after the payout is confirmed.
- Partner payout history is updated with the payment confirmation and transaction reference.

## 4. Record The Final Payment

1. As Admin, move the test lead to `Final Payment Clearance`.
2. Open `Client Payments` and record a `Final` payment of `$800`.
3. Include the received date and unique payment reference.

The current portal also records the client payment method as additional reconciliation metadata.

Expected:

- A Final payment cannot be recorded before `Final Payment Clearance`.
- Deal summary shows Advance `$200`, Final `$800`, Total `$1,000`, Outstanding `$0`.
- The remaining `$80` commission becomes payable.
- The partner is notified that the remaining commission has become payable.

## 5. Test Rejection And Final Payout

1. As Partner, request the remaining `$80` from `My Commissions`.
2. As Admin, open `Payout Requests` and select Reject.
3. Try submitting with an empty reason.
4. Enter a clear reason and reject the request.
5. As Partner, confirm the rejected status and reason, then submit the `$80` request again.
6. As Admin, approve it and record the external payment amount, date, method, and transaction
   reference.

Expected:

- Empty rejection reason is blocked.
- The partner is notified of the rejection and can see the reason.
- After approval and external payment recording, the partner is notified of confirmation.
- Partner payout history is updated with the final payment information.

## Additional Portal Safeguards

The current implementation also enforces the following controls. They are useful QA checks, but they
are additional application behavior rather than wording from the business requirements:

- The paid amount must match the approved payout amount.
- An already requested or paid commission balance cannot be requested a second time.
- Partners cannot view client payment records.
- Notifications are isolated to their intended account or partner profile.
- Notification actions route only to pages allowed for the signed-in role.

## Additional Engineering Verification

These automated checks are implementation and release tools, not business requirements.

Configure `.env.local` with the real Supabase URL, publishable key, and server-only service-role key.
Run the commercial workflow verification with:

```bash
node scripts/verify-pipeline-workflow.mjs
```

A passing run ends with:

```text
Pipeline and commercial workflow verification passed
```

For the additional notification recipient-isolation check, use two Sales Partner fixtures or run:

```bash
node scripts/verify-agreement-access.mjs
```

The equivalent manual notification QA is:

Use two Sales Partner accounts when checking notifications:

1. Create a payout request as Partner A.
2. Confirm Admin receives the review notification.
3. Confirm Partner A receives only their commission and payout updates.
4. Confirm Partner B does not receive Partner A's notifications.
5. Open a notification and use `Open related page`; it must route to the correct role-safe screen.
