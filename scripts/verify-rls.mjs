import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const anon =
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const accounts = {
  partnerA: {
    email: process.env.RLS_PARTNER_A_EMAIL,
    password: process.env.RLS_PARTNER_A_PASSWORD,
  },
  partnerB: {
    email: process.env.RLS_PARTNER_B_EMAIL,
    password: process.env.RLS_PARTNER_B_PASSWORD,
  },
  admin: {
    email: process.env.RLS_ADMIN_EMAIL,
    password: process.env.RLS_ADMIN_PASSWORD,
  },
  superAdmin: {
    email: process.env.RLS_SUPER_ADMIN_EMAIL,
    password: process.env.RLS_SUPER_ADMIN_PASSWORD,
  },
};

function required(name, value) {
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function client() {
  return createClient(required("SUPABASE_URL", url), required("SUPABASE_ANON_KEY", anon), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function signIn(label) {
  const credentials = accounts[label];
  required(`${label} email`, credentials.email);
  required(`${label} password`, credentials.password);
  const supabase = client();
  const { error } = await supabase.auth.signInWithPassword(credentials);
  if (error) throw new Error(`${label} login failed: ${error.message}`);
  return supabase;
}

async function expectNoRows(label, promise) {
  const { data, error } = await promise;
  if (error) return;
  if (data && data.length > 0)
    throw new Error(`${label}: expected no rows, received ${data.length}`);
}

async function expectError(label, promise) {
  const { error } = await promise;
  if (!error) throw new Error(`${label}: expected RLS error`);
}

async function expectStorageSuccess(label, promise) {
  const { data, error } = await promise;
  if (error || !data) throw new Error(`${label}: ${error?.message || "no file returned"}`);
}

async function expectStorageDenied(label, promise) {
  const { data, error } = await promise;
  if (!error && data) throw new Error(`${label}: storage access unexpectedly succeeded`);
}

async function expectNoMutation(label, before, mutationPromise, afterPromise, field) {
  const { data, error } = await mutationPromise;
  if (error) return;
  if (data && data.length > 0) {
    throw new Error(`${label}: mutation returned ${data.length} row(s)`);
  }
  const { data: after, error: afterError } = await afterPromise;
  if (afterError) throw new Error(`${label}: unable to verify row after mutation`);
  const afterRow = Array.isArray(after) ? after[0] : after;
  if (afterRow?.[field] !== before?.[field]) {
    throw new Error(`${label}: ${field} changed from ${before?.[field]} to ${afterRow?.[field]}`);
  }
}

async function main() {
  const partnerA = await signIn("partnerA");
  const partnerB = await signIn("partnerB");
  const admin = await signIn("admin");
  const superAdmin = await signIn("superAdmin");

  const { data: partnerAProfile, error: partnerAProfileError } = await partnerA
    .from("profiles")
    .select("partner_id")
    .single();
  const { data: partnerBProfile, error: partnerBProfileError } = await partnerB
    .from("profiles")
    .select("partner_id")
    .single();

  if (
    partnerAProfileError ||
    partnerBProfileError ||
    !partnerAProfile?.partner_id ||
    !partnerBProfile?.partner_id
  ) {
    throw new Error("Partner test users must be linked to partner profiles.");
  }

  await expectNoRows(
    "Partner A cannot select Partner B leads",
    partnerA.from("leads").select("id").eq("partner_id", partnerBProfile.partner_id),
  );
  await expectNoRows(
    "Partner A cannot select Partner B commissions",
    partnerA.from("commissions").select("id").eq("partner_id", partnerBProfile.partner_id),
  );
  await expectNoRows(
    "Partner A cannot select Partner B payouts",
    partnerA.from("payout_requests").select("id").eq("partner_id", partnerBProfile.partner_id),
  );
  await expectNoRows(
    "Partner A cannot select Partner B documents",
    partnerA.from("partner_documents").select("id").eq("partner_id", partnerBProfile.partner_id),
  );

  const { data: partnerBLeads, error: partnerBLeadError } = await partnerB
    .from("leads")
    .select("id")
    .limit(100);
  if (partnerBLeadError)
    throw new Error(`Partner B lead lookup failed: ${partnerBLeadError.message}`);
  const partnerBLeadIds = (partnerBLeads || []).map((lead) => lead.id);
  if (partnerBLeadIds.length > 0) {
    await expectNoRows(
      "Partner A cannot select Partner B lead attachments",
      partnerA.from("lead_attachments").select("id").in("lead_id", partnerBLeadIds),
    );
    await expectNoRows(
      "Partner A cannot select Partner B discovery calls",
      partnerA.from("discovery_calls").select("id").in("lead_id", partnerBLeadIds),
    );
  }
  await expectNoRows(
    "Partner cannot select client payments",
    partnerA.from("client_payments").select("id").limit(1),
  );
  await expectNoRows(
    "Partner cannot select private lead activity",
    partnerA.from("lead_activity_log").select("id").eq("is_private", true).limit(1),
  );
  await expectNoRows(
    "Partner cannot select historical disputes",
    partnerA.from("disputes").select("id").limit(1),
  );
  await expectNoRows(
    "Partner cannot access audit log",
    partnerA.from("audit_log").select("id").limit(1),
  );

  const documentPath = process.env.RLS_PARTNER_B_DOCUMENT_PATH;
  const privateDocumentPath = process.env.RLS_PARTNER_B_PRIVATE_DOCUMENT_PATH;
  const leadViewPath = process.env.RLS_PARTNER_B_LEAD_VIEW_PATH;
  const leadDeletePath = process.env.RLS_PARTNER_B_LEAD_DELETE_PATH;
  const signaturePath = process.env.RLS_PARTNER_B_SIGNATURE_PATH;
  if (documentPath && privateDocumentPath && leadViewPath && leadDeletePath) {
    await expectStorageDenied(
      "Partner A cannot download Partner B document",
      partnerA.storage.from("partner-documents").download(documentPath),
    );
    await expectStorageSuccess(
      "Partner B can download own public document",
      partnerB.storage.from("partner-documents").download(documentPath),
    );
    await expectStorageDenied(
      "Partner B cannot download own private document",
      partnerB.storage.from("partner-documents").download(privateDocumentPath),
    );
    await partnerA.storage.from("lead-attachments").remove([leadViewPath]);
    await expectStorageSuccess(
      "Partner A cannot delete Partner B attachment",
      partnerB.storage.from("lead-attachments").download(leadViewPath),
    );
    await expectStorageDenied(
      "Partner A cannot download Partner B attachment",
      partnerA.storage.from("lead-attachments").download(leadViewPath),
    );
    const { error: ownDeleteError } = await partnerB.storage
      .from("lead-attachments")
      .remove([leadDeletePath]);
    if (ownDeleteError)
      throw new Error(`Partner B own attachment delete failed: ${ownDeleteError.message}`);
    await expectStorageDenied(
      "Deleted attachment is no longer downloadable",
      partnerB.storage.from("lead-attachments").download(leadDeletePath),
    );
    if (signaturePath) {
      await expectStorageSuccess(
        "Partner B can download own uploaded signature",
        partnerB.storage.from("partner-signatures").download(signaturePath),
      );
      await expectStorageDenied(
        "Partner A cannot download Partner B uploaded signature",
        partnerA.storage.from("partner-signatures").download(signaturePath),
      );
      await expectStorageSuccess(
        "Admin can review an uploaded partner signature",
        admin.storage.from("partner-signatures").download(signaturePath),
      );
    }
  }

  const { data: ownLead } = await partnerA
    .from("leads")
    .select("id,stage,status")
    .limit(1)
    .maybeSingle();
  if (ownLead?.id) {
    await expectNoMutation(
      "Partner cannot update lead stage",
      ownLead,
      partnerA
        .from("leads")
        .update({ stage: "Proposal Sent" })
        .eq("id", ownLead.id)
        .select("id,stage"),
      partnerA.from("leads").select("id,stage").eq("id", ownLead.id),
      "stage",
    );
    await expectNoMutation(
      "Partner cannot update lead status",
      ownLead,
      partnerA
        .from("leads")
        .update({ status: "Closed Won" })
        .eq("id", ownLead.id)
        .select("id,status"),
      partnerA.from("leads").select("id,status").eq("id", ownLead.id),
      "status",
    );
  }

  const { data: ownCommission } = await partnerA
    .from("commissions")
    .select("id,state")
    .limit(1)
    .maybeSingle();
  if (ownCommission?.id) {
    await expectNoMutation(
      "Partner cannot update commission fields",
      ownCommission,
      partnerA
        .from("commissions")
        .update({ state: "Paid" })
        .eq("id", ownCommission.id)
        .select("id,state"),
      partnerA.from("commissions").select("id,state").eq("id", ownCommission.id),
      "state",
    );
  }

  const { error: adminOperationalError } = await admin.from("leads").select("id").limit(1);
  if (adminOperationalError)
    throw new Error(`Admin operational read failed: ${adminOperationalError.message}`);

  const { error: superAuditError } = await superAdmin.from("audit_log").select("id").limit(1);
  if (superAuditError) throw new Error(`Super Admin audit read failed: ${superAuditError.message}`);

  const { error: adminAgreementError } = await admin
    .from("agreement_documents")
    .select("id")
    .limit(1);
  if (adminAgreementError)
    throw new Error(`Admin agreement document read failed: ${adminAgreementError.message}`);

  console.log("RLS verification passed");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
