import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { createClient } from "@supabase/supabase-js";

function loadEnvFile(file) {
  const path = resolve(file);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].trim().replace(/^['"]|['"]$/g, "");
    }
  }
}

loadEnvFile(".env.local");

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey =
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
if (!url || !serviceKey || !anonKey) {
  throw new Error("Missing Supabase URL, service-role key, or publishable/anon key.");
}

const service = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const stamp = `${Date.now()}-${randomBytes(3).toString("hex")}`;
const password = `Flow!${randomBytes(18).toString("base64url")}9a`;
const createdUserIds = [];
const seeded = { payoutIds: [], extraLeadIds: [] };

async function must(promise, label) {
  const result = await promise;
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
}

async function expectError(promise, label) {
  const result = await promise;
  if (!result.error) throw new Error(`${label}: expected an error`);
}

async function expectBlockedMutation(promise, label) {
  const result = await promise;
  if (!result.error && result.data?.length) {
    throw new Error(`${label}: mutation changed ${result.data.length} row(s)`);
  }
}

async function expectValue(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${expected}, received ${actual}`);
  }
}

async function within(promise, label, timeoutMs = 15000) {
  let timeout;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error(`${label}: timed out`)), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

async function createAccount(label, role) {
  const email = `codex-flow-${label}-${stamp}@example.com`;
  const data = await must(
    service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: `Flow ${label}`, role },
    }),
    `Create ${label}`,
  );
  createdUserIds.push(data.user.id);
  await must(
    service
      .from("profiles")
      .update({ full_name: `Flow ${label}`, role, account_status: "active" })
      .eq("id", data.user.id),
    `Activate ${label}`,
  );
  return { id: data.user.id, email };
}

async function signIn(account) {
  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await must(
    client.auth.signInWithPassword({ email: account.email, password }),
    `Sign in ${account.email}`,
  );
  return client;
}

async function resetLead(stage = "Identified Opportunity", previousStage = null) {
  await must(
    service
      .from("leads")
      .update({
        stage,
        previous_stage: previousStage,
        status: "Open",
        confirmed_value: null,
        closed_reason: null,
      })
      .eq("id", seeded.leadId),
    `Reset lead to ${stage}`,
  );
}

async function cleanup() {
  if (seeded.invitationId) {
    await service.from("invitations").delete().eq("id", seeded.invitationId);
  }
  if (seeded.partnerId) {
    await service.from("notifications").delete().eq("partner_id", seeded.partnerId);
  }
  if (createdUserIds.length) {
    await service.from("notifications").delete().in("recipient_id", createdUserIds);
    await service.from("audit_log").delete().in("actor_id", createdUserIds);
  }
  if (seeded.payoutIds.length) {
    await service.from("payout_requests").delete().in("id", seeded.payoutIds);
  }
  if (seeded.leadId) {
    await service.from("client_payments").delete().eq("lead_id", seeded.leadId);
    await service.from("lead_activity_log").delete().eq("lead_id", seeded.leadId);
    await service.from("commissions").delete().eq("lead_id", seeded.leadId);
    await service.from("leads").delete().eq("id", seeded.leadId);
  }
  if (seeded.extraLeadIds.length) {
    await service.from("leads").delete().in("id", seeded.extraLeadIds);
  }
  for (const userId of createdUserIds) await service.auth.admin.deleteUser(userId);
  if (seeded.partnerId) {
    await service.from("partner_profiles").delete().eq("id", seeded.partnerId);
  }
}

try {
  const adminAccount = await createAccount("admin", "admin");
  const partnerAccount = await createAccount("partner", "partner");
  const partner = await must(
    service
      .from("partner_profiles")
      .insert({
        user_id: partnerAccount.id,
        name: `Flow Partner ${stamp}`,
        email: partnerAccount.email,
        status: "active",
        commission_rate: 10,
        agreements_required: false,
      })
      .select("id")
      .single(),
    "Create partner profile",
  );
  seeded.partnerId = partner.id;
  await must(
    service.from("profiles").update({ partner_id: partner.id }).eq("id", partnerAccount.id),
    "Link partner profile",
  );
  const invitationSignedAt = new Date().toISOString();
  const invitation = await must(
    service
      .from("invitations")
      .insert({
        email: partnerAccount.email,
        role: "partner",
        partner_id: partner.id,
        invited_by: adminAccount.id,
        agreement_signer_name: "Flow admin",
        agreement_signer_role: "admin",
        agreement_signed_at: invitationSignedAt,
        token_hash: `flow-${stamp}`,
        expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      })
      .select("id")
      .single(),
    "Create signed invitation snapshot",
  );
  seeded.invitationId = invitation.id;
  const lead = await must(
    service
      .from("leads")
      .insert({
        partner_id: partner.id,
        company_name: `Flow Company ${stamp}`,
        contact_name: "Flow Contact",
        contact_title: "Director",
        contact_email: `flow-contact-${stamp}@example.com`,
        country: "Pakistan",
        industry: "Technology",
        estimated_value: 1000,
        currency: "USD",
        description:
          "Temporary live workflow verification lead with enough detail to pass validation rules.",
        stage: "Identified Opportunity",
        status: "Open",
        created_by: partnerAccount.id,
      })
      .select("id")
      .single(),
    "Create workflow lead",
  );
  seeded.leadId = lead.id;

  const admin = await signIn(adminAccount);
  const partnerClient = await signIn(partnerAccount);

  const agreementIssuers = await must(
    partnerClient.rpc("get_current_partner_agreement_issuer"),
    "Partner reads own agreement issuer",
  );
  await expectValue(agreementIssuers.length, 1, "Agreement issuer row count");
  await expectValue(agreementIssuers[0].signer_name, "Flow admin", "Agreement issuer name");
  await expectValue(agreementIssuers[0].signer_role, "admin", "Agreement issuer role");
  const adminAgreementIssuers = await must(
    admin.rpc("get_current_partner_agreement_issuer"),
    "Admin agreement issuer isolation query",
  );
  await expectValue(
    adminAgreementIssuers.length,
    0,
    "Admin cannot impersonate partner issuer read",
  );

  const companyOnlyMatchId = globalThis.crypto.randomUUID();
  const companyOnlyMatch = await must(
    partnerClient.rpc("submit_partner_lead", {
      lead_id: companyOnlyMatchId,
      company_name: `Flow Company ${stamp}`,
      contact_name: "Second Flow Contact",
      contact_title: "Director",
      contact_email: `flow-company-only-${stamp}@example.com`,
      contact_phone: "+1 (202) 555-0199",
      client_linkedin: null,
      country: "Pakistan",
      industry: "Technology",
      estimated_value: 1500,
      currency: "USD",
      description:
        "This submission deliberately reuses only the company name to verify that the contact remains a valid new lead.",
    }),
    "Company-only match accepted",
  );
  await expectValue(companyOnlyMatch.accepted, true, "Company name is not a duplicate key");
  seeded.extraLeadIds.push(companyOnlyMatchId);

  const duplicateEmailId = globalThis.crypto.randomUUID();
  const duplicateEmail = await must(
    partnerClient.rpc("submit_partner_lead", {
      lead_id: duplicateEmailId,
      company_name: `Different Email Duplicate ${stamp}`,
      contact_name: "Duplicate Contact",
      contact_title: "Director",
      contact_email: `flow-contact-${stamp}@example.com`,
      contact_phone: "+1 202 555 0110",
      client_linkedin: null,
      country: "Pakistan",
      industry: "Technology",
      estimated_value: 1500,
      currency: "USD",
      description:
        "This submission deliberately reuses a contact email and must be rejected without creating a pipeline record.",
    }),
    "Duplicate email rejected",
  );
  await expectValue(duplicateEmail.accepted, false, "Duplicate email response");
  const duplicateEmailRows = await must(
    service.from("leads").select("id").eq("id", duplicateEmailId),
    "Check duplicate email persistence",
  );
  await expectValue(duplicateEmailRows.length, 0, "Duplicate email creates no lead");

  const duplicatePhoneId = globalThis.crypto.randomUUID();
  const duplicatePhone = await must(
    partnerClient.rpc("submit_partner_lead", {
      lead_id: duplicatePhoneId,
      company_name: `Different Phone Duplicate ${stamp}`,
      contact_name: "Duplicate Contact",
      contact_title: "Director",
      contact_email: `flow-phone-duplicate-${stamp}@example.com`,
      contact_phone: "12025550199",
      client_linkedin: null,
      country: "Pakistan",
      industry: "Technology",
      estimated_value: 1500,
      currency: "USD",
      description:
        "This submission deliberately reuses a normalized phone number and must not create a lead record in the pipeline.",
    }),
    "Duplicate phone rejected",
  );
  await expectValue(duplicatePhone.accepted, false, "Duplicate phone response");
  const duplicatePhoneRows = await must(
    service.from("leads").select("id").eq("id", duplicatePhoneId),
    "Check duplicate phone persistence",
  );
  await expectValue(duplicatePhoneRows.length, 0, "Duplicate phone creates no lead");

  const partnerStages = ["Outreach Started", "In Communication", "Discovery Call"];
  for (const stage of partnerStages) {
    await resetLead();
    const moved = await must(
      partnerClient.rpc("update_lead_stage_secure", {
        target_lead: lead.id,
        target_stage: stage,
        change_reason: null,
      }),
      `Partner moves to ${stage}`,
    );
    await expectValue(moved.stage, stage, `Partner stage ${stage}`);
  }

  const adminStages = [
    "Contract Sent",
    "Advance Pending",
    "Advance Confirmed",
    "Sent to Product",
    "Done by Product",
    "Client Review",
    "Under Revisions",
    "Final Payment Clearance",
    "Final Handoff",
    "Closed Won",
  ];
  for (const stage of adminStages) {
    await resetLead();
    await expectError(
      partnerClient.rpc("update_lead_stage_secure", {
        target_lead: lead.id,
        target_stage: stage,
        change_reason: null,
      }),
      `Partner blocked from ${stage}`,
    );
  }

  await resetLead();
  await expectError(
    partnerClient.rpc("update_lead_stage_secure", {
      target_lead: lead.id,
      target_stage: "Closed Lost",
      change_reason: null,
    }),
    "Closed Lost requires a reason",
  );
  const closedLost = await must(
    partnerClient.rpc("update_lead_stage_secure", {
      target_lead: lead.id,
      target_stage: "Closed Lost",
      change_reason: "Client declined the opportunity.",
    }),
    "Partner closes lead as lost",
  );
  await expectValue(closedLost.stage, "Closed Lost", "Partner Closed Lost");

  await resetLead("Discovery Call");
  await must(
    partnerClient.rpc("update_lead_stage_secure", {
      target_lead: lead.id,
      target_stage: "On Hold",
      change_reason: null,
    }),
    "Partner places own stage on hold",
  );
  await must(
    partnerClient.rpc("update_lead_stage_secure", {
      target_lead: lead.id,
      target_stage: "Discovery Call",
      change_reason: null,
    }),
    "Partner resumes own stage",
  );
  await resetLead("On Hold", "Contract Sent");
  await expectError(
    partnerClient.rpc("update_lead_stage_secure", {
      target_lead: lead.id,
      target_stage: "Contract Sent",
      change_reason: null,
    }),
    "Partner cannot resume admin-controlled stage",
  );
  await must(
    admin.rpc("update_lead_stage_secure", {
      target_lead: lead.id,
      target_stage: "Contract Sent",
      change_reason: null,
    }),
    "Admin resumes admin-controlled stage",
  );

  await expectBlockedMutation(
    partnerClient.from("leads").update({ stage: "Final Handoff" }).eq("id", lead.id).select("id"),
    "Partner direct stage update denied by RLS",
  );
  const stageAfterDirectUpdate = await must(
    service.from("leads").select("stage").eq("id", lead.id).single(),
    "Verify direct stage update",
  );
  await expectValue(
    stageAfterDirectUpdate.stage,
    "Contract Sent",
    "Stage after blocked direct update",
  );
  await expectError(
    partnerClient.rpc("update_lead_commercial_value_secure", {
      target_lead: lead.id,
      new_value: 1100,
    }),
    "Partner commercial value edit denied",
  );
  await resetLead();
  await expectError(
    admin.rpc("update_lead_commercial_value_secure", {
      target_lead: lead.id,
      new_value: 1100,
    }),
    "Admin value edit before Contract Sent denied",
  );
  await resetLead("Contract Sent");
  const valued = await must(
    admin.rpc("update_lead_commercial_value_secure", {
      target_lead: lead.id,
      new_value: 1000,
    }),
    "Admin commercial value edit",
  );
  await expectValue(Number(valued.estimated_value), 1000, "Commercial value");

  await resetLead();
  await expectError(
    admin.rpc("record_client_payment_and_eligibility", {
      target_lead: lead.id,
      payment_amount: 200,
      payment_date: new Date().toISOString().slice(0, 10),
      payment_reference: `EARLY-${stamp}`,
      payment_method: "Wire Transfer",
      payment_type: "Advance",
      payment_notes: null,
    }),
    "Advance payment before milestone denied",
  );
  await resetLead("Advance Confirmed");
  await must(
    admin.rpc("record_client_payment_and_eligibility", {
      target_lead: lead.id,
      payment_amount: 200,
      payment_date: new Date().toISOString().slice(0, 10),
      payment_reference: `ADV-${stamp}`,
      payment_method: "Wire Transfer",
      payment_type: "Advance",
      payment_notes: "Live verification",
    }),
    "Record advance payment",
  );
  let commission = await must(
    service.from("commissions").select("*").eq("lead_id", lead.id).single(),
    "Read advance commission",
  );
  await expectValue(Number(commission.amount), 100, "Total commission");
  await expectValue(Number(commission.eligible_amount), 20, "Advance commission release");
  const hiddenPayments = await must(
    partnerClient.from("client_payments").select("id").eq("lead_id", lead.id),
    "Partner client payment query",
  );
  await expectValue(hiddenPayments.length, 0, "Partner client payment visibility");

  const firstPayout = await must(
    partnerClient.rpc("request_commission_payout", {
      commission_ids: [commission.id],
      message: "Advance commission payout",
    }),
    "Request advance payout",
  );
  seeded.payoutIds.push(firstPayout.id);
  await expectValue(Number(firstPayout.amount), 20, "Advance payout amount");
  await expectBlockedMutation(
    admin
      .from("payout_requests")
      .update({ status: "Approved" })
      .eq("id", firstPayout.id)
      .select("id"),
    "Direct payout update denied",
  );
  const statusAfterDirectUpdate = await must(
    service.from("payout_requests").select("status").eq("id", firstPayout.id).single(),
    "Verify direct payout update",
  );
  await expectValue(statusAfterDirectUpdate.status, "Pending", "Blocked payout status");
  await must(
    admin.rpc("review_payout_request", {
      target_payout: firstPayout.id,
      approve_request: true,
      rejection_reason: null,
    }),
    "Approve advance payout",
  );

  let resolvePayoutEvent;
  let resolveCommissionEvent;
  const payoutEvent = new Promise((resolve) => {
    resolvePayoutEvent = resolve;
  });
  const commissionEvent = new Promise((resolve) => {
    resolveCommissionEvent = resolve;
  });
  const realtimeChannel = partnerClient
    .channel(`payout-completion-${stamp}`)
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "payout_requests",
        filter: `id=eq.${firstPayout.id}`,
      },
      (payload) => resolvePayoutEvent(payload.new),
    )
    .on(
      "postgres_changes",
      {
        event: "UPDATE",
        schema: "public",
        table: "commissions",
        filter: `id=eq.${commission.id}`,
      },
      (payload) => resolveCommissionEvent(payload.new),
    );
  await within(
    new Promise((resolve, reject) => {
      realtimeChannel.subscribe((status, error) => {
        if (status === "SUBSCRIBED") resolve();
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          reject(error || new Error(`Realtime subscription failed: ${status}`));
        }
      });
    }),
    "Partner Realtime subscription",
  );

  await must(
    admin.rpc("record_payout_paid", {
      target_payout: firstPayout.id,
      payment_amount: 20,
      paid_on: new Date().toISOString().slice(0, 10),
      method: "Bank Transfer",
      reference: `PAYOUT-ADV-${stamp}`,
    }),
    "Record advance payout paid",
  );
  const [livePayout, liveCommission] = await Promise.all([
    within(payoutEvent, "Partner payout completion event"),
    within(commissionEvent, "Partner commission paid event"),
  ]);
  await expectValue(livePayout.status, "Paid", "Realtime payout state");
  await expectValue(
    livePayout.transaction_reference,
    `PAYOUT-ADV-${stamp}`,
    "Realtime payout reference",
  );
  await expectValue(Number(liveCommission.paid_amount), 20, "Realtime paid commission amount");
  await partnerClient.removeChannel(realtimeChannel);
  commission = await must(
    service.from("commissions").select("*").eq("id", commission.id).single(),
    "Read paid advance commission",
  );
  await expectValue(Number(commission.paid_amount), 20, "Advance commission paid");
  await expectError(
    partnerClient.rpc("request_commission_payout", {
      commission_ids: [commission.id],
      message: "No balance should remain",
    }),
    "No duplicate payout before final payment",
  );

  await resetLead("Final Payment Clearance");
  await must(
    admin.rpc("record_client_payment_and_eligibility", {
      target_lead: lead.id,
      payment_amount: 800,
      payment_date: new Date().toISOString().slice(0, 10),
      payment_reference: `FINAL-${stamp}`,
      payment_method: "Wire Transfer",
      payment_type: "Final",
      payment_notes: "Live verification",
    }),
    "Record final payment",
  );
  commission = await must(
    service.from("commissions").select("*").eq("id", commission.id).single(),
    "Read final commission",
  );
  await expectValue(Number(commission.eligible_amount), 100, "Final commission release");
  const rejectedPayout = await must(
    partnerClient.rpc("request_commission_payout", {
      commission_ids: [commission.id],
      message: "Remaining commission payout",
    }),
    "Request remaining payout",
  );
  seeded.payoutIds.push(rejectedPayout.id);
  await expectValue(Number(rejectedPayout.amount), 80, "Remaining payout amount");
  await expectError(
    admin.rpc("review_payout_request", {
      target_payout: rejectedPayout.id,
      approve_request: false,
      rejection_reason: "",
    }),
    "Payout rejection reason required",
  );
  await must(
    admin.rpc("review_payout_request", {
      target_payout: rejectedPayout.id,
      approve_request: false,
      rejection_reason: "Verification rejection reason.",
    }),
    "Reject payout with reason",
  );

  const finalPayout = await must(
    partnerClient.rpc("request_commission_payout", {
      commission_ids: [commission.id],
      message: "Retry remaining commission payout",
    }),
    "Retry remaining payout",
  );
  seeded.payoutIds.push(finalPayout.id);
  await must(
    admin.rpc("review_payout_request", {
      target_payout: finalPayout.id,
      approve_request: true,
      rejection_reason: null,
    }),
    "Approve final payout",
  );
  await expectError(
    admin.rpc("record_payout_paid", {
      target_payout: finalPayout.id,
      payment_amount: 79,
      paid_on: new Date().toISOString().slice(0, 10),
      method: "Bank Transfer",
      reference: `PAYOUT-WRONG-${stamp}`,
    }),
    "External payout amount must match approved amount",
  );
  await must(
    admin.rpc("record_payout_paid", {
      target_payout: finalPayout.id,
      payment_amount: 80,
      paid_on: new Date().toISOString().slice(0, 10),
      method: "Bank Transfer",
      reference: `PAYOUT-FINAL-${stamp}`,
    }),
    "Record final payout paid",
  );
  commission = await must(
    service.from("commissions").select("*").eq("id", commission.id).single(),
    "Read fully paid commission",
  );
  await expectValue(Number(commission.paid_amount), 100, "Total commission paid");
  await expectValue(commission.state, "Paid", "Final commission state");

  await expectError(
    partnerClient.rpc("close_lead_won_secure", {
      target_lead: lead.id,
      confirmed_deal_value: 1200,
    }),
    "Partner cannot close lead won",
  );
  const closedWon = await must(
    admin.rpc("close_lead_won_secure", {
      target_lead: lead.id,
      confirmed_deal_value: 1200,
    }),
    "Admin closes lead won",
  );
  await expectValue(closedWon.stage, "Closed Won", "Admin Closed Won");
  commission = await must(
    service.from("commissions").select("*").eq("id", commission.id).single(),
    "Read recalculated Closed Won commission",
  );
  await expectValue(Number(commission.amount), 120, "Recalculated commission total");
  await expectValue(Number(commission.eligible_amount), 120, "Recalculated commission release");
  await expectValue(commission.state, "Unpaid", "Recalculated commission state");

  const payments = await must(
    service.from("client_payments").select("payment_type,amount_received").eq("lead_id", lead.id),
    "Read payment summary",
  );
  const advance = payments
    .filter((payment) => payment.payment_type === "Advance")
    .reduce((sum, payment) => sum + Number(payment.amount_received), 0);
  const final = payments
    .filter((payment) => payment.payment_type === "Final")
    .reduce((sum, payment) => sum + Number(payment.amount_received), 0);
  await expectValue(advance, 200, "Advance payment summary");
  await expectValue(final, 800, "Final payment summary");
  await expectValue(advance + final, 1000, "Total payment summary");
  await expectValue(
    Number(closedWon.confirmed_value) - advance - final,
    200,
    "Outstanding payment summary",
  );

  const partnerNotifications = await must(
    service.from("notifications").select("title").eq("partner_id", partner.id),
    "Read partner notifications",
  );
  for (const title of [
    "Advance commission now payable",
    "Final commission now payable",
    "Payout rejected",
    "Payout confirmed",
  ]) {
    if (!partnerNotifications.some((notification) => notification.title === title)) {
      throw new Error(`Missing partner notification: ${title}`);
    }
  }

  const adminNotifications = await must(
    service.from("notifications").select("title").eq("recipient_id", adminAccount.id),
    "Read Admin payout notifications",
  );
  if (!adminNotifications.some((notification) => notification.title === "New payout request")) {
    throw new Error("Missing Admin notification: New payout request");
  }

  console.log("Pipeline and commercial workflow verification passed");
} finally {
  await cleanup();
}
