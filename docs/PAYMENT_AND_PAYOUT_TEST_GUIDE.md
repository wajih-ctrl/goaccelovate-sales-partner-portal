# Client Payment And Payout Test Guide

This guide verifies the production flow with one Admin and one Sales Partner. Use an approved test
deal and references that clearly identify the test. Client payment details are Admin-only.

## Automated Live Verification

Configure `.env.local` with the real Supabase URL, publishable key, and server-only service-role key,
then run:

```bash
node scripts/verify-pipeline-workflow.mjs
```

The script creates isolated temporary users and records, tests the complete flow, and cleans up the
business fixtures. A passing run ends with:

```text
Pipeline and commercial workflow verification passed
```

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
4. Enter `$200`, the received date, a unique reference, and the payment method.
5. Submit the form.

Expected:

- The payment appears in the payment table.
- Deal payment summary shows Advance `$200`, Final `$0`, Total `$200`, Outstanding `$800`.
- The partner's payable commission becomes `$20`.
- The partner receives `Advance commission now payable`.
- The partner cannot query or view the client payment record.

## 3. Request And Pay The Advance Commission

1. Sign in as the Sales Partner and open `My Commissions`.
2. Confirm `Triggered earnings` includes `$20` and the test commission shows `$20` payable.
3. Select `Request Payout`, choose the test commission, and submit.
4. Confirm the request appears in `Payout history` on the same page.
5. Sign in as Admin and open `Payout Requests`.
6. Confirm the new request is `$20` and approve it.
7. Select `Mark paid` and enter exactly `$20`, the date, method, and transaction reference.

Expected:

- Admin receives `New payout request`.
- The request moves from Pending to Approved and then Paid.
- A different paid amount is rejected.
- The partner receives `Payout confirmed`.
- Partner payout history shows Paid and the transaction reference.
- The commission paid balance becomes `$20` and no second advance payout can be requested.

## 4. Record The Final Payment

1. As Admin, move the test lead to `Final Payment Clearance`.
2. Open `Client Payments` and record a `Final` payment of `$800`.
3. Include the date, unique payment reference, and method.

Expected:

- A Final payment cannot be recorded before `Final Payment Clearance`.
- Deal summary shows Advance `$200`, Final `$800`, Total `$1,000`, Outstanding `$0`.
- The remaining `$80` commission becomes payable.
- The partner receives `Final commission now payable`.

## 5. Test Rejection And Final Payout

1. As Partner, request the remaining `$80` from `My Commissions`.
2. As Admin, open `Payout Requests` and select Reject.
3. Try submitting with an empty reason.
4. Enter a clear reason and reject the request.
5. As Partner, confirm the rejected status and reason, then submit the `$80` request again.
6. As Admin, approve it and record the external payment for exactly `$80`.

Expected:

- Empty rejection reason is blocked.
- Partner receives `Payout rejected` with the reason.
- A rejected request releases the unpaid balance for a new request.
- After the final payment, commission paid balance is `$100` and state is Paid.
- Partner receives `Payout confirmed` and payout history shows the final reference.

## Notification Isolation

Use two Sales Partner accounts when checking notifications:

1. Create a payout request as Partner A.
2. Confirm Admin receives the review notification.
3. Confirm Partner A receives only their commission and payout updates.
4. Confirm Partner B does not receive Partner A's notifications.
5. Open a notification and use `Open related page`; it must route to the correct role-safe screen.

The direct live recipient-isolation test is:

```bash
node scripts/verify-agreement-access.mjs
```
