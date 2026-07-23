import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
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
const password = `Rls!${randomBytes(18).toString("base64url")}9a`;
const accounts = {
  superAdmin: { email: `codex-rls-super-${stamp}@example.com`, role: "super_admin" },
  admin: { email: `codex-rls-admin-${stamp}@example.com`, role: "admin" },
  partnerA: { email: `codex-rls-partner-a-${stamp}@example.com`, role: "partner" },
  partnerB: { email: `codex-rls-partner-b-${stamp}@example.com`, role: "partner" },
};
const createdUserIds = [];
const storageObjects = {
  "partner-documents": [],
  "lead-attachments": [],
  "partner-signatures": [],
};
const seeded = {};

async function must(promise, label) {
  const result = await promise;
  if (result.error) throw new Error(`${label}: ${result.error.message}`);
  return result.data;
}

async function createAccount(key) {
  const account = accounts[key];
  const data = await must(
    service.auth.admin.createUser({
      email: account.email,
      password,
      email_confirm: true,
      user_metadata: { full_name: `RLS ${key}`, role: account.role },
    }),
    `Create ${key}`,
  );
  createdUserIds.push(data.user.id);
  await must(
    service
      .from("profiles")
      .update({ full_name: `RLS ${key}`, role: account.role, account_status: "active" })
      .eq("id", data.user.id),
    `Activate ${key}`,
  );
  return data.user;
}

async function cleanup() {
  for (const [bucket, paths] of Object.entries(storageObjects)) {
    if (paths.length) await service.storage.from(bucket).remove(paths);
  }
  if (seeded.auditId) await service.from("audit_log").delete().eq("id", seeded.auditId);
  if (seeded.disputeId) await service.from("disputes").delete().eq("id", seeded.disputeId);
  if (seeded.paymentId) await service.from("client_payments").delete().eq("id", seeded.paymentId);
  if (seeded.payoutId) await service.from("payout_requests").delete().eq("id", seeded.payoutId);
  if (seeded.callIds?.length)
    await service.from("discovery_calls").delete().in("id", seeded.callIds);
  if (seeded.leadIds?.length) {
    await service.from("lead_activity_log").delete().in("lead_id", seeded.leadIds);
    await service.from("lead_attachments").delete().in("lead_id", seeded.leadIds);
  }
  if (seeded.partnerIds?.length)
    await service.from("partner_documents").delete().in("partner_id", seeded.partnerIds);
  if (seeded.commissionIds?.length)
    await service.from("commissions").delete().in("id", seeded.commissionIds);
  if (seeded.leadIds?.length) await service.from("leads").delete().in("id", seeded.leadIds);
  for (const userId of createdUserIds) await service.auth.admin.deleteUser(userId);
  if (seeded.partnerIds?.length)
    await service.from("partner_profiles").delete().in("id", seeded.partnerIds);
}

try {
  const superAdmin = await createAccount("superAdmin");
  const admin = await createAccount("admin");
  const partnerAUser = await createAccount("partnerA");
  const partnerBUser = await createAccount("partnerB");

  const partnerRows = await must(
    service
      .from("partner_profiles")
      .insert([
        {
          user_id: partnerAUser.id,
          name: `RLS Partner A ${stamp}`,
          email: accounts.partnerA.email,
          status: "active",
          commission_rate: 10,
          agreements_required: false,
        },
        {
          user_id: partnerBUser.id,
          name: `RLS Partner B ${stamp}`,
          email: accounts.partnerB.email,
          status: "active",
          commission_rate: 12,
          agreements_required: false,
        },
      ])
      .select("id,email"),
    "Create partner profiles",
  );
  const partnerA = partnerRows.find((row) => row.email === accounts.partnerA.email);
  const partnerB = partnerRows.find((row) => row.email === accounts.partnerB.email);
  seeded.partnerIds = [partnerA.id, partnerB.id];
  await must(
    service.from("profiles").update({ partner_id: partnerA.id }).eq("id", partnerAUser.id),
    "Link Partner A",
  );
  await must(
    service.from("profiles").update({ partner_id: partnerB.id }).eq("id", partnerBUser.id),
    "Link Partner B",
  );

  const leadRows = await must(
    service
      .from("leads")
      .insert([
        {
          partner_id: partnerA.id,
          company_name: `RLS Company A ${stamp}`,
          contact_name: "RLS Contact A",
          contact_title: "Director",
          contact_email: `rls-contact-a-${stamp}@example.com`,
          country: "Pakistan",
          industry: "Technology",
          estimated_value: 10000,
          currency: "USD",
          description:
            "Temporary RLS verification lead with sufficient description content for validation.",
          stage: "Identified Opportunity",
          status: "Open",
          created_by: partnerAUser.id,
        },
        {
          partner_id: partnerB.id,
          company_name: `RLS Company B ${stamp}`,
          contact_name: "RLS Contact B",
          contact_title: "Director",
          contact_email: `rls-contact-b-${stamp}@example.com`,
          country: "Pakistan",
          industry: "Technology",
          estimated_value: 20000,
          currency: "USD",
          description:
            "Temporary RLS verification lead with sufficient description content for validation.",
          stage: "Advance Confirmed",
          status: "Open",
          created_by: partnerBUser.id,
        },
      ])
      .select("id,partner_id"),
    "Seed leads",
  );
  const leadA = leadRows.find((row) => row.partner_id === partnerA.id);
  const leadB = leadRows.find((row) => row.partner_id === partnerB.id);
  seeded.leadIds = [leadA.id, leadB.id];

  const commissionRows = await must(
    service
      .from("commissions")
      .insert([
        {
          lead_id: leadA.id,
          partner_id: partnerA.id,
          rate: 10,
          base_amount: 10000,
          amount: 1000,
          eligible_amount: 500,
          paid_amount: 0,
          state: "Unpaid",
        },
        {
          lead_id: leadB.id,
          partner_id: partnerB.id,
          rate: 12,
          base_amount: 20000,
          amount: 2400,
          eligible_amount: 1200,
          paid_amount: 0,
          state: "Unpaid",
        },
      ])
      .select("id,partner_id"),
    "Seed commissions",
  );
  const commissionB = commissionRows.find((row) => row.partner_id === partnerB.id);
  seeded.commissionIds = commissionRows.map((row) => row.id);

  const payout = await must(
    service
      .from("payout_requests")
      .insert({ partner_id: partnerB.id, requested_by: partnerBUser.id, amount: 100 })
      .select("id")
      .single(),
    "Seed payout",
  );
  seeded.payoutId = payout.id;
  const payment = await must(
    service
      .from("client_payments")
      .insert({
        lead_id: leadB.id,
        amount_received: 100,
        received_date: new Date().toISOString().slice(0, 10),
        payment_method: "Wire Transfer",
        payment_reference: `RLS-${stamp}`,
        trigger_commission_eligibility: true,
        payment_type: "Advance",
        created_by: admin.id,
      })
      .select("id")
      .single(),
    "Seed client payment",
  );
  seeded.paymentId = payment.id;
  await must(
    service.from("lead_activity_log").insert({
      lead_id: leadB.id,
      type: "admin_note",
      actor_id: admin.id,
      actor_name: "RLS Admin",
      text: "Temporary private RLS verification note.",
      is_private: true,
    }),
    "Seed private note",
  );
  const calls = await must(
    service
      .from("discovery_calls")
      .insert(
        [false, true].map((isPrivate) => ({
          lead_id: leadB.id,
          call_at: new Date().toISOString(),
          duration_minutes: 15,
          goaccelovate_attendees: "RLS Admin",
          client_attendees: "RLS Client",
          summary: "Temporary RLS call",
          outcomes: "Verification",
          next_steps: "Cleanup",
          is_private: isPrivate,
          created_by: admin.id,
        })),
      )
      .select("id"),
    "Seed discovery calls",
  );
  seeded.callIds = calls.map((row) => row.id);
  const dispute = await must(
    service
      .from("disputes")
      .insert({
        commission_id: commissionB.id,
        partner_id: partnerB.id,
        opened_by: partnerBUser.id,
        reason: "Historical RLS verification record",
      })
      .select("id")
      .single(),
    "Seed historical dispute",
  );
  seeded.disputeId = dispute.id;
  const audit = await must(
    service
      .from("audit_log")
      .insert({
        actor_id: superAdmin.id,
        actor_name: "RLS Super Admin",
        action: "RLS Verification",
        module: "Security",
        record_name: stamp,
      })
      .select("id")
      .single(),
    "Seed audit entry",
  );
  seeded.auditId = audit.id;

  const documentPath = `${partnerBUser.id}/${stamp}/public.pdf`;
  const privateDocumentPath = `${partnerBUser.id}/${stamp}/private.pdf`;
  const leadViewPath = `${partnerBUser.id}/${leadB.id}/view.pdf`;
  const leadDeletePath = `${partnerBUser.id}/${leadB.id}/delete.pdf`;
  const signaturePath = `${partnerBUser.id}/agreement/${stamp}.png`;
  for (const path of [documentPath, privateDocumentPath]) {
    await must(
      service.storage
        .from("partner-documents")
        .upload(path, new TextEncoder().encode("%PDF-1.4 RLS test"), {
          contentType: "application/pdf",
        }),
      `Upload ${path}`,
    );
    storageObjects["partner-documents"].push(path);
  }
  for (const path of [leadViewPath, leadDeletePath]) {
    await must(
      service.storage
        .from("lead-attachments")
        .upload(path, new TextEncoder().encode("%PDF-1.4 RLS test"), {
          contentType: "application/pdf",
        }),
      `Upload ${path}`,
    );
    storageObjects["lead-attachments"].push(path);
  }
  await must(
    service.storage
      .from("partner-signatures")
      .upload(signaturePath, new TextEncoder().encode("RLS signature image"), {
        contentType: "image/png",
      }),
    "Upload partner signature",
  );
  storageObjects["partner-signatures"].push(signaturePath);
  await must(
    service.from("partner_documents").insert([
      {
        partner_id: partnerB.id,
        name: "public.pdf",
        storage_bucket: "partner-documents",
        storage_path: documentPath,
        is_private: false,
        uploaded_by: admin.id,
      },
      {
        partner_id: partnerB.id,
        name: "private.pdf",
        storage_bucket: "partner-documents",
        storage_path: privateDocumentPath,
        is_private: true,
        uploaded_by: admin.id,
      },
    ]),
    "Seed partner documents",
  );
  await must(
    service.from("lead_attachments").insert(
      [leadViewPath, leadDeletePath].map((path) => ({
        lead_id: leadB.id,
        uploaded_by: partnerBUser.id,
        name: path.endsWith("view.pdf") ? "view.pdf" : "delete.pdf",
        storage_bucket: "lead-attachments",
        storage_path: path,
        is_private: false,
      })),
    ),
    "Seed lead attachments",
  );

  const verification = spawnSync("node", ["scripts/verify-rls.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      SUPABASE_URL: url,
      SUPABASE_ANON_KEY: anonKey,
      RLS_SUPER_ADMIN_EMAIL: accounts.superAdmin.email,
      RLS_SUPER_ADMIN_PASSWORD: password,
      RLS_ADMIN_EMAIL: accounts.admin.email,
      RLS_ADMIN_PASSWORD: password,
      RLS_PARTNER_A_EMAIL: accounts.partnerA.email,
      RLS_PARTNER_A_PASSWORD: password,
      RLS_PARTNER_B_EMAIL: accounts.partnerB.email,
      RLS_PARTNER_B_PASSWORD: password,
      RLS_PARTNER_B_DOCUMENT_PATH: documentPath,
      RLS_PARTNER_B_PRIVATE_DOCUMENT_PATH: privateDocumentPath,
      RLS_PARTNER_B_LEAD_VIEW_PATH: leadViewPath,
      RLS_PARTNER_B_LEAD_DELETE_PATH: leadDeletePath,
      RLS_PARTNER_B_SIGNATURE_PATH: signaturePath,
    },
  });
  if (verification.stdout) process.stdout.write(verification.stdout);
  if (verification.stderr) process.stderr.write(verification.stderr);
  if (verification.status !== 0) throw new Error("RLS verification process failed.");

  const existingSession = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await must(
    existingSession.auth.signInWithPassword({ email: accounts.partnerA.email, password }),
    "Sign in before suspension",
  );
  const beforeSuspend = await must(
    existingSession.from("leads").select("id").eq("partner_id", partnerA.id),
    "Read before suspension",
  );
  if (!beforeSuspend.length) throw new Error("Partner A had no readable lead before suspension.");
  await must(
    service.from("profiles").update({ account_status: "suspended" }).eq("id", partnerAUser.id),
    "Suspend Partner A",
  );
  const afterSuspend = await must(
    existingSession.from("leads").select("id").eq("partner_id", partnerA.id),
    "Read after suspension",
  );
  if (afterSuspend.length) throw new Error("Suspended Partner A retained RLS data access.");
  console.log("Suspended-session RLS verification passed");
} finally {
  await cleanup();
}
