import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const anon = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

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

async function main() {
  const partnerA = await signIn("partnerA");
  const partnerB = await signIn("partnerB");
  const admin = await signIn("admin");
  const superAdmin = await signIn("superAdmin");

  const { data: partnerAProfile } = await partnerA.from("profiles").select("partner_id").single();
  const { data: partnerBProfile } = await partnerB.from("profiles").select("partner_id").single();

  if (!partnerAProfile?.partner_id || !partnerBProfile?.partner_id) {
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
  await expectNoRows(
    "Partner cannot select client payments",
    partnerA.from("client_payments").select("id").limit(1),
  );
  await expectNoRows(
    "Partner cannot access audit log",
    partnerA.from("audit_log").select("id").limit(1),
  );

  const { data: ownLead } = await partnerA.from("leads").select("id").limit(1).maybeSingle();
  if (ownLead?.id) {
    await expectError(
      "Partner cannot update lead stage",
      partnerA.from("leads").update({ stage: "Proposal Sent" }).eq("id", ownLead.id),
    );
    await expectError(
      "Partner cannot update lead status",
      partnerA.from("leads").update({ status: "Closed Won" }).eq("id", ownLead.id),
    );
  }

  const { data: ownCommission } = await partnerA
    .from("commissions")
    .select("id")
    .limit(1)
    .maybeSingle();
  if (ownCommission?.id) {
    await expectError(
      "Partner cannot update commission fields",
      partnerA.from("commissions").update({ state: "Paid" }).eq("id", ownCommission.id),
    );
  }

  const { error: adminOperationalError } = await admin.from("leads").select("id").limit(1);
  if (adminOperationalError)
    throw new Error(`Admin operational read failed: ${adminOperationalError.message}`);

  const { error: superAuditError } = await superAdmin.from("audit_log").select("id").limit(1);
  if (superAuditError) throw new Error(`Super Admin audit read failed: ${superAuditError.message}`);

  console.log("RLS verification passed");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
